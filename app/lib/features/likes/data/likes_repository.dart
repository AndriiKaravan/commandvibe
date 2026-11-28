import 'package:commandvibe/core/api/api_client.dart';

abstract interface class LikesRepository {
  /// Gives or takes back the caller's like under [authorMemberId]'s photo of [dayIndex].
  Future<void> setLiked(
    String groupId,
    int dayIndex,
    String authorMemberId,
    bool liked,
  );
}

class ApiLikesRepository implements LikesRepository {
  ApiLikesRepository(this._api);

  final ApiClient _api;

  @override
  Future<void> setLiked(
    String groupId,
    int dayIndex,
    String authorMemberId,
    bool liked,
  ) {
    final path =
        '/groups/$groupId/days/$dayIndex/submissions/$authorMemberId/like';
    return liked ? _api.put(path) : _api.delete(path);
  }
}
