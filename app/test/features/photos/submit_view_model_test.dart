import 'dart:typed_data';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/features/photos/ui/submit_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_photos_repository.dart';

void main() {
  group('SubmitViewModel', () {
    late FakePhotosRepository repository;
    late FakePhotoSource source;
    late SubmitViewModel model;

    setUp(() {
      repository = FakePhotosRepository();
      source = FakePhotoSource(aPicked(aJpeg()));
      model = SubmitViewModel(
        repository,
        source,
        groupId: 'g1',
        dayIndex: 0,
        retryDelay: Duration.zero,
      );
    });

    tearDown(() => model.dispose());

    test('should send the picked photo with its origin and finish', () async {
      source.next = aPicked(aJpeg(), origin: PhotoOrigin.camera);
      await model.pick(PhotoOrigin.camera);
      expect(model.state, isA<SubmitDone>());
      expect(repository.submits.single.photo.origin, PhotoOrigin.camera);
      expect(repository.submits.single.replaces, isNull);
    });

    test('should refuse a photo above 15 MiB without sending it', () async {
      source.next = aPicked(aJpeg(SubmitViewModel.maxUploadBytes + 1));
      await model.pick(PhotoOrigin.gallery);
      expect((model.state as SubmitFailed).error, SubmitError.tooLarge);
      expect(repository.submits, isEmpty);
    });

    test('should send a photo of exactly 15 MiB', () async {
      source.next = aPicked(aJpeg(SubmitViewModel.maxUploadBytes));
      await model.pick(PhotoOrigin.gallery);
      expect(model.state, isA<SubmitDone>());
      expect(repository.submits, hasLength(1));
    });

    test('should refuse heic by its magic bytes without sending it', () async {
      source.next = aPicked(
        Uint8List.fromList([0, 0, 0, 24, ...'ftypheic'.codeUnits, 0, 0, 0, 0]),
      );
      await model.pick(PhotoOrigin.gallery);
      expect((model.state as SubmitFailed).error, SubmitError.heicUnsupported);
      expect(repository.submits, isEmpty);
    });

    test('should refuse a file that is not an image', () async {
      source.next = aPicked(Uint8List.fromList('hello world'.codeUnits));
      await model.pick(PhotoOrigin.gallery);
      expect((model.state as SubmitFailed).error, SubmitError.unsupportedType);
      expect(repository.submits, isEmpty);
    });

    test('should stay idle when the person cancels the picker', () async {
      source.next = null;
      await model.pick(PhotoOrigin.gallery);
      expect(model.state, isA<SubmitIdle>());
      expect(repository.submits, isEmpty);
    });

    test('should ask before replacing when a photo already exists', () async {
      repository.submitErrors = [
        ApiException(
          409,
          code: 'already_submitted',
          details: {'version': 'v1'},
        ),
      ];
      await model.pick(PhotoOrigin.gallery);
      expect((model.state as SubmitConfirmReplace).version, 'v1');
      await model.confirmReplace();
      expect(model.state, isA<SubmitDone>());
      expect(repository.submits.last.replaces, 'v1');
      expect(repository.submits, hasLength(2));
    });

    test('should retry a busy server three times, then give up', () async {
      repository.submitErrors = List.generate(
        5,
        (_) => ApiException(503, code: 'busy'),
      );
      await model.pick(PhotoOrigin.gallery);
      expect((model.state as SubmitFailed).error, SubmitError.failed);
      expect(repository.submits, hasLength(4));
    });

    test('should succeed when the server stops being busy', () async {
      repository.submitErrors = [ApiException(503, code: 'busy')];
      await model.pick(PhotoOrigin.gallery);
      expect(model.state, isA<SubmitDone>());
      expect(repository.submits, hasLength(2));
    });

    test(
      'should keep the same bytes for a retry after a network failure',
      () async {
        repository.submitErrors = [NetworkException('offline')];
        final picked = aPicked(aJpeg(200));
        source.next = picked;
        await model.pick(PhotoOrigin.gallery);
        expect((model.state as SubmitFailed).error, SubmitError.network);
        await model.retry();
        expect(model.state, isA<SubmitDone>());
        expect(
          identical(repository.submits.last.photo.bytes, picked.bytes),
          isTrue,
        );
      },
    );

    test('should map the server refusals to readable errors', () async {
      final cases = {
        ApiException(413, code: 'photo_too_large'): SubmitError.tooLarge,
        ApiException(415, code: 'heic_unsupported'):
            SubmitError.heicUnsupported,
        ApiException(415, code: 'unsupported_type'):
            SubmitError.unsupportedType,
        ApiException(422, code: 'invalid_image'): SubmitError.invalidImage,
        ApiException(409, code: 'day_not_open'): SubmitError.dayClosed,
        ApiException(409, code: 'game_finished'): SubmitError.dayClosed,
        ApiException(409, code: 'reveal_passed'): SubmitError.revealPassed,
        ApiException(409, code: 'photo_hidden'): SubmitError.photoHidden,
      };
      for (final entry in cases.entries) {
        repository.submitErrors = [entry.key];
        await model.pick(PhotoOrigin.gallery);
        expect(
          (model.state as SubmitFailed).error,
          entry.value,
          reason: '${entry.key}',
        );
      }
    });
  });
}
