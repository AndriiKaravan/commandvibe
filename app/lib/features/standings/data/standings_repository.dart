import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';

abstract interface class StandingsRepository {
  Future<Standings> standings(String groupId);
}

class ApiStandingsRepository implements StandingsRepository {
  ApiStandingsRepository(this._api);

  final ApiClient _api;

  @override
  Future<Standings> standings(String groupId) async => Standings.fromJson(
    await _api.get('/groups/$groupId/standings') as Map<String, dynamic>,
  );
}
