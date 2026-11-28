import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';

abstract interface class ProgressRepository {
  Future<GameProgress> progress(String groupId);
}

class ApiProgressRepository implements ProgressRepository {
  ApiProgressRepository(this._api);

  final ApiClient _api;

  @override
  Future<GameProgress> progress(String groupId) async => GameProgress.fromJson(
    await _api.get('/groups/$groupId/progress') as Map<String, dynamic>,
  );
}
