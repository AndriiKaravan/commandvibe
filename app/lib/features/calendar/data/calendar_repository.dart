import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';

abstract interface class CalendarRepository {
  Future<List<TaskItem>> catalog({GameCategory? category, String? query});

  Future<Calendar> saveGame(String groupId, GameSetup setup);

  Future<Calendar> calendar(String groupId);

  /// The "Other" button: the server picks a new task for [day].
  Future<CalendarDay> other(String groupId, int day);

  Future<CalendarDay> setCatalogTask(String groupId, int day, String taskId);

  Future<CalendarDay> setCustomTask(String groupId, int day, CustomTask task);

  /// Swaps the tasks of [day] and [to].
  Future<Calendar> move(String groupId, int day, int to);
}

class ApiCalendarRepository implements CalendarRepository {
  ApiCalendarRepository(this._api);

  final ApiClient _api;

  static String _days(String groupId, int day) =>
      '/groups/$groupId/calendar/days/$day';

  @override
  Future<List<TaskItem>> catalog({
    GameCategory? category,
    String? query,
  }) async {
    final path = Uri(
      path: '/catalog',
      queryParameters: {'category': ?category?.name, 'q': ?query},
    ).toString();
    final json = await _api.get(path) as Map<String, dynamic>;
    return [
      for (final task in (json['tasks'] as List<dynamic>))
        TaskItem.fromJson(task as Map<String, dynamic>),
    ];
  }

  @override
  Future<Calendar> saveGame(String groupId, GameSetup setup) async =>
      Calendar.fromJson(
        await _api.put('/groups/$groupId/game', body: setup.toJson())
            as Map<String, dynamic>,
      );

  @override
  Future<Calendar> calendar(String groupId) async => Calendar.fromJson(
    await _api.get('/groups/$groupId/calendar') as Map<String, dynamic>,
  );

  @override
  Future<CalendarDay> other(String groupId, int day) async =>
      CalendarDay.fromJson(
        await _api.post('${_days(groupId, day)}/other') as Map<String, dynamic>,
      );

  @override
  Future<CalendarDay> setCatalogTask(
    String groupId,
    int day,
    String taskId,
  ) async => CalendarDay.fromJson(
    await _api.put('${_days(groupId, day)}/task', body: {'taskId': taskId})
        as Map<String, dynamic>,
  );

  @override
  Future<CalendarDay> setCustomTask(
    String groupId,
    int day,
    CustomTask task,
  ) async => CalendarDay.fromJson(
    await _api.put('${_days(groupId, day)}/task', body: task.toJson())
        as Map<String, dynamic>,
  );

  @override
  Future<Calendar> move(String groupId, int day, int to) async =>
      Calendar.fromJson(
        await _api.post('${_days(groupId, day)}/move', body: {'to': to})
            as Map<String, dynamic>,
      );
}
