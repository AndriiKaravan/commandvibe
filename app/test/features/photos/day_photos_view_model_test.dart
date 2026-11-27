import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/ui/day_photos_view_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

import 'fake_photos_repository.dart';

RealtimeEvent _event(String type) => RealtimeEvent(
  topic: 'group:g1',
  type: type,
  data: const {},
  id: 'e-$type',
  serverTime: DateTime.utc(2026, 12, 1, 9),
);

void main() {
  group('DayPhotosViewModel', () {
    late FakePhotosRepository repository;
    late FakeRealtimeClient realtime;
    late DayPhotosViewModel viewModel;
    var now = DateTime.utc(2026, 12, 1, 9);

    setUp(() {
      now = DateTime.utc(2026, 12, 1, 9);
      repository = FakePhotosRepository(
        day: aDay(items: [aSubmission(access: PhotoAccess.blur)]),
      );
      realtime = FakeRealtimeClient();
      viewModel = DayPhotosViewModel(
        repository,
        realtime,
        groupId: 'g1',
        dayIndex: 0,
        clock: () => now,
      );
    });

    tearDown(() => viewModel.dispose());

    Future<void> start() async {
      viewModel.start();
      await pumpEventQueue();
    }

    test('should load the day when the topic is joined', () async {
      await start();
      expect(viewModel.day?.items, hasLength(1));
      expect(repository.dayReads, 1);
    });

    test(
      'should read again when a photo is added, replaced or hidden',
      () async {
        await start();
        for (final type in [
          'submission.created',
          'submission.replaced',
          'submission.hidden',
          'submission.restored',
        ]) {
          final before = repository.dayReads;
          realtime.emit(_event(type));
          await pumpEventQueue();
          expect(repository.dayReads, before + 1, reason: type);
        }
      },
    );

    test('should show the revealed photos when the day is revealed', () async {
      await start();
      repository.dayData = aDay(revealed: true, items: [aSubmission()]);
      realtime.emit(_event('photos.revealed'));
      await pumpEventQueue();
      expect(viewModel.day?.revealed, isTrue);
      expect(viewModel.day?.items.single.photoUrl, isNotNull);
    });

    test('should ignore events that do not concern photos', () async {
      await start();
      final before = repository.dayReads;
      realtime.emit(_event('member.joined'));
      await pumpEventQueue();
      expect(repository.dayReads, before);
    });

    test(
      'should refresh links at most once in 30 seconds when an image fails',
      () async {
        await start();
        final before = repository.dayReads;
        // Links fetched a moment ago cannot have expired, so a failing image does not reload yet.
        viewModel.imageFailed();
        await pumpEventQueue();
        expect(repository.dayReads, before);
        now = now.add(const Duration(seconds: 31));
        viewModel.imageFailed();
        viewModel.imageFailed();
        await pumpEventQueue();
        expect(repository.dayReads, before + 1);
        now = now.add(const Duration(seconds: 31));
        viewModel.imageFailed();
        await pumpEventQueue();
        expect(repository.dayReads, before + 2);
      },
    );
  });
}
