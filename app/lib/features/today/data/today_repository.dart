import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/today/data/today_models.dart';

abstract interface class TodayRepository {
  Future<Today> today(String groupId);

  /// The chosen member spins today's roulette.
  Future<void> spin(String groupId);
}

class ApiTodayRepository implements TodayRepository {
  ApiTodayRepository(this._api);

  final ApiClient _api;

  @override
  Future<Today> today(String groupId) async => Today.fromJson(
    await _api.get('/groups/$groupId/today') as Map<String, dynamic>,
  );

  @override
  Future<void> spin(String groupId) =>
      _api.post('/groups/$groupId/roulette/spin');
}
