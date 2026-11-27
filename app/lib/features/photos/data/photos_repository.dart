import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/features/photos/data/photo_type.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';

abstract interface class PhotosRepository {
  Future<DaySubmissions> day(String groupId, int dayIndex);

  /// Uploads [photo]; with [replaces] it replaces the author's earlier version instead of creating.
  Future<SubmissionItem> submit(
    String groupId,
    int dayIndex,
    PickedPhoto photo, {
    String? replaces,
  });

  Future<void> complain(
    String groupId,
    int dayIndex,
    String memberId,
    ComplaintReason reason,
  );

  Future<List<ComplaintItem>> complaints(String groupId);

  Future<void> setHidden(
    String groupId,
    int dayIndex,
    String memberId,
    bool hidden,
  );

  Future<void> dismiss(String groupId, int dayIndex, String memberId);
}

class ApiPhotosRepository implements PhotosRepository {
  ApiPhotosRepository(this._api);

  final ApiClient _api;

  @override
  Future<DaySubmissions> day(String groupId, int dayIndex) async =>
      DaySubmissions.fromJson(
        await _api.get('/groups/$groupId/days/$dayIndex/submissions')
            as Map<String, dynamic>,
        _api.baseUri,
      );

  @override
  Future<SubmissionItem> submit(
    String groupId,
    int dayIndex,
    PickedPhoto photo, {
    String? replaces,
  }) async {
    final query = [
      'source=${photo.origin.name}',
      if (replaces != null) 'replaces=${Uri.encodeQueryComponent(replaces)}',
    ].join('&');
    final response = await _api.upload(
      replaces == null ? 'POST' : 'PUT',
      '/groups/$groupId/days/$dayIndex/submission?$query',
      photo.bytes,
      contentType: contentTypeOf(sniffPhotoType(photo.bytes)),
    );
    return SubmissionItem.fromJson(
      response! as Map<String, dynamic>,
      _api.baseUri,
    );
  }

  @override
  Future<void> complain(
    String groupId,
    int dayIndex,
    String memberId,
    ComplaintReason reason,
  ) => _api.post(
    '/groups/$groupId/days/$dayIndex/submissions/$memberId/complaints',
    body: {'reason': reason.wire},
  );

  @override
  Future<List<ComplaintItem>> complaints(String groupId) async {
    final response =
        await _api.get('/groups/$groupId/complaints') as Map<String, dynamic>;
    return [
      for (final item in response['items'] as List<dynamic>)
        ComplaintItem.fromJson(item as Map<String, dynamic>),
    ];
  }

  @override
  Future<void> setHidden(
    String groupId,
    int dayIndex,
    String memberId,
    bool hidden,
  ) => _api.put(
    '/groups/$groupId/days/$dayIndex/submissions/$memberId/hidden',
    body: {'hidden': hidden},
  );

  @override
  Future<void> dismiss(
    String groupId,
    int dayIndex,
    String memberId,
  ) => _api.post(
    '/groups/$groupId/days/$dayIndex/submissions/$memberId/complaints/dismiss',
  );
}
