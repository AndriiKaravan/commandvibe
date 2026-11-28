import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/feed/data/feed_models.dart';

abstract interface class FeedRepository {
  Future<FeedPage> page(
    String groupId, {
    FeedFilter filter = const FeedFilter(),
    String? before,
    int limit = 20,
  });
}

class ApiFeedRepository implements FeedRepository {
  ApiFeedRepository(this._api);

  final ApiClient _api;

  @override
  Future<FeedPage> page(
    String groupId, {
    FeedFilter filter = const FeedFilter(),
    String? before,
    int limit = 20,
  }) async {
    final query = [
      'limit=$limit',
      if (filter.day != null) 'day=${filter.day}',
      if (filter.memberId != null)
        'memberId=${Uri.encodeQueryComponent(filter.memberId!)}',
      if (filter.mine) 'mine=1',
      if (before != null) 'before=${Uri.encodeQueryComponent(before)}',
    ].join('&');
    return FeedPage.fromJson(
      await _api.get('/groups/$groupId/feed?$query') as Map<String, dynamic>,
      _api.baseUri,
    );
  }
}
