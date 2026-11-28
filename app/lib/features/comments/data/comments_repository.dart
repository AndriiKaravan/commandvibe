import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/comments/data/comments_models.dart';

abstract interface class CommentsRepository {
  Future<List<CommentItem>> list(
    String groupId,
    int dayIndex,
    String authorMemberId,
  );

  Future<CommentItem> add(
    String groupId,
    int dayIndex,
    String authorMemberId,
    String text,
  );

  Future<void> delete(
    String groupId,
    int dayIndex,
    String authorMemberId,
    String commentId,
  );
}

class ApiCommentsRepository implements CommentsRepository {
  ApiCommentsRepository(this._api);

  final ApiClient _api;

  String _base(String groupId, int dayIndex, String authorMemberId) =>
      '/groups/$groupId/days/$dayIndex/submissions/$authorMemberId/comments';

  @override
  Future<List<CommentItem>> list(
    String groupId,
    int dayIndex,
    String authorMemberId,
  ) async {
    final json =
        await _api.get(_base(groupId, dayIndex, authorMemberId))
            as Map<String, dynamic>;
    return [
      for (final item in json['items'] as List<dynamic>)
        CommentItem.fromJson(item as Map<String, dynamic>),
    ];
  }

  @override
  Future<CommentItem> add(
    String groupId,
    int dayIndex,
    String authorMemberId,
    String text,
  ) async => CommentItem.fromJson(
    await _api.post(
          _base(groupId, dayIndex, authorMemberId),
          body: {'text': text},
        )
        as Map<String, dynamic>,
  );

  @override
  Future<void> delete(
    String groupId,
    int dayIndex,
    String authorMemberId,
    String commentId,
  ) => _api.delete('${_base(groupId, dayIndex, authorMemberId)}/$commentId');
}
