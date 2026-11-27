import 'dart:typed_data';

import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/data/photos_repository.dart';

final jpegHead = [0xff, 0xd8, 0xff, 0xe0];

Uint8List aJpeg([int length = 64]) {
  final bytes = Uint8List(length);
  bytes.setAll(0, jpegHead);
  return bytes;
}

PickedPhoto aPicked(
  Uint8List bytes, {
  PhotoOrigin origin = PhotoOrigin.gallery,
}) => PickedPhoto(bytes: bytes, name: 'photo.jpg', origin: origin);

SubmissionItem aSubmission({
  String memberId = 'm1',
  String name = 'Ira',
  PhotoAccess access = PhotoAccess.full,
  bool mine = false,
  String? version,
  String? status,
  Moderation? moderation,
}) => SubmissionItem(
  memberId: memberId,
  displayName: name,
  submittedAt: DateTime.utc(2026, 12, 1, 8),
  access: access,
  photoUrl: access == PhotoAccess.full
      ? Uri.parse('https://api.test/p/photo-$memberId')
      : null,
  blurUrl: Uri.parse('https://api.test/p/blur-$memberId'),
  width: 1600,
  height: 1200,
  mine: mine,
  version: version,
  status: status,
  moderation: moderation,
);

DaySubmissions aDay({
  bool canSubmit = true,
  bool revealed = false,
  SubmissionItem? mine,
  List<SubmissionItem> items = const [],
  DateTime? revealAt,
}) => DaySubmissions(
  dayIndex: 0,
  revealAt: revealAt ?? DateTime.utc(2026, 12, 3, 7),
  revealed: revealed,
  canSubmit: canSubmit,
  mine: mine,
  items: items,
  total: items.length + (mine == null ? 0 : 1),
  serverTime: DateTime.utc(2026, 12, 1, 9),
);

class SubmitCall {
  SubmitCall(this.photo, this.replaces);

  final PickedPhoto photo;
  final String? replaces;
}

class FakePhotosRepository implements PhotosRepository {
  FakePhotosRepository({DaySubmissions? day}) : dayData = day ?? aDay();

  DaySubmissions dayData;
  int dayReads = 0;
  final List<SubmitCall> submits = [];

  /// Errors thrown by successive `submit` calls; once exhausted, submit succeeds.
  List<Object> submitErrors = [];
  final List<String> actions = [];
  List<ComplaintItem> complaintItems = const [];

  @override
  Future<DaySubmissions> day(String groupId, int dayIndex) async {
    dayReads++;
    return dayData;
  }

  @override
  Future<SubmissionItem> submit(
    String groupId,
    int dayIndex,
    PickedPhoto photo, {
    String? replaces,
  }) async {
    submits.add(SubmitCall(photo, replaces));
    if (submitErrors.isNotEmpty) {
      throw submitErrors.removeAt(0);
    }
    return aSubmission(mine: true, version: 'v-new');
  }

  @override
  Future<void> complain(
    String groupId,
    int dayIndex,
    String memberId,
    ComplaintReason reason,
  ) async => actions.add('complain:$memberId:${reason.name}');

  @override
  Future<List<ComplaintItem>> complaints(String groupId) async =>
      complaintItems;

  @override
  Future<void> setHidden(
    String groupId,
    int dayIndex,
    String memberId,
    bool hidden,
  ) async => actions.add('hidden:$memberId:$hidden');

  @override
  Future<void> dismiss(String groupId, int dayIndex, String memberId) async =>
      actions.add('dismiss:$memberId');
}

class FakePhotoSource implements PhotoSource {
  FakePhotoSource(this.next);

  PickedPhoto? next;

  @override
  Future<PickedPhoto?> pick(PhotoOrigin origin) async => next;
}
