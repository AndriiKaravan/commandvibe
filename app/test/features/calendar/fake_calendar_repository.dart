import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/data/calendar_repository.dart';

TaskItem aTask(String id, {bool custom = false}) => TaskItem(
  id: custom ? null : id,
  title: TaskText(uk: 'Завдання $id', en: 'Task $id'),
  description: TaskText(uk: 'Опис $id', en: 'Text $id'),
  custom: custom,
  categories: const [GameCategory.home],
);

CalendarDay aDay(
  int index, {
  DayState state = DayState.closed,
  TaskItem? task,
  bool hideTask = false,
}) => CalendarDay(
  dayIndex: index,
  date: '2026-12-${(index + 1).toString().padLeft(2, '0')}',
  opensAt: DateTime.utc(2026, 12, index + 1, 7),
  state: state,
  task: hideTask ? null : task ?? aTask('t$index'),
);

Calendar aCalendar({int days = 7, Set<int> open = const {}}) => Calendar(
  game: GameInfo(
    startDate: '2026-12-01',
    days: days,
    openTime: '09:00',
    mode: GameMode.auto,
    categories: const [GameCategory.home],
  ),
  days: [
    for (var i = 0; i < days; i++)
      aDay(i, state: open.contains(i) ? DayState.open : DayState.closed),
  ],
  serverTime: DateTime.utc(2026, 11, 30, 10),
);

/// Records calls and answers from a mutable calendar, like the server would.
class FakeCalendarRepository implements CalendarRepository {
  FakeCalendarRepository(this.calendarValue);

  Calendar calendarValue;
  Object? error;
  GameSetup? savedSetup;
  final List<String> calls = [];
  List<TaskItem> catalogResults = const [];

  void _maybeFail() {
    if (error != null) {
      throw error!;
    }
  }

  @override
  Future<Calendar> calendar(String groupId) async {
    calls.add('calendar');
    _maybeFail();
    return calendarValue;
  }

  @override
  Future<Calendar> saveGame(String groupId, GameSetup setup) async {
    calls.add('saveGame');
    _maybeFail();
    savedSetup = setup;
    return calendarValue;
  }

  @override
  Future<CalendarDay> other(String groupId, int day) async {
    calls.add('other:$day');
    _maybeFail();
    final replaced = aDay(day, task: aTask('other$day'));
    calendarValue = Calendar(
      game: calendarValue.game,
      days: [
        for (final item in calendarValue.days)
          item.dayIndex == day ? replaced : item,
      ],
      serverTime: calendarValue.serverTime,
    );
    return replaced;
  }

  @override
  Future<CalendarDay> setCatalogTask(
    String groupId,
    int day,
    String taskId,
  ) async {
    calls.add('setCatalogTask:$day:$taskId');
    _maybeFail();
    return aDay(day, task: aTask(taskId));
  }

  @override
  Future<CalendarDay> setCustomTask(
    String groupId,
    int day,
    CustomTask task,
  ) async {
    calls.add('setCustomTask:$day:${task.title.uk}');
    _maybeFail();
    return aDay(
      day,
      task: TaskItem(
        title: task.title,
        description: task.description,
        custom: true,
        categories: const [],
      ),
    );
  }

  @override
  Future<Calendar> move(String groupId, int day, int to) async {
    calls.add('move:$day:$to');
    _maybeFail();
    return calendarValue;
  }

  @override
  Future<List<TaskItem>> catalog({
    GameCategory? category,
    String? query,
  }) async {
    calls.add('catalog:${category?.name}:$query');
    _maybeFail();
    return catalogResults;
  }
}
