import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/points/data/points_models.dart';

abstract interface class PointsRepository {
  Future<PointsJournal> journal(String groupId);
}

class ApiPointsRepository implements PointsRepository {
  ApiPointsRepository(this._api);

  final ApiClient _api;

  @override
  Future<PointsJournal> journal(String groupId) async => PointsJournal.fromJson(
    await _api.get('/groups/$groupId/points') as Map<String, dynamic>,
  );
}
