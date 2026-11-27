import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/today/data/today_models.dart';
import 'package:commandvibe/features/today/data/today_repository.dart';
import 'package:ks_core/ks_core.dart';

TaskItem aTodayTask() => const TaskItem(
  id: 'snowman',
  title: TaskText(uk: 'Сніговик', en: 'Snowman'),
  description: TaskText(uk: 'Зліпи сніговика', en: 'Build a snowman'),
  custom: false,
  categories: [GameCategory.winter],
);

final serverNow = DateTime.utc(2026, 12, 1, 7, 0, 30);

RealtimeEvent eventOf(String type) => RealtimeEvent(
  topic: 'group:g1',
  type: type,
  data: const {},
  id: 'e-$type',
  serverTime: serverNow,
);

Today aToday({
  TodayStatus status = TodayStatus.active,
  DayState state = DayState.open,
  TaskItem? task,
  bool withTask = true,
  String? pickerMemberId,
  bool? isMyTurn,
  DateTime? pickDeadlineAt,
  SpinInfo? spin,
  DateTime? at,
}) => Today(
  status: status,
  serverTime: at ?? serverNow,
  day: status == TodayStatus.notConfigured
      ? null
      : TodayDay(
          day: CalendarDay(
            dayIndex: 0,
            date: '2026-12-01',
            opensAt: DateTime.utc(2026, 12, 1, 7),
            state: state,
            task: withTask && state == DayState.open
                ? task ?? aTodayTask()
                : null,
          ),
          pickerMemberId: pickerMemberId,
          pickDeadlineAt: pickDeadlineAt,
          isMyTurn: isMyTurn,
          spin: spin,
        ),
);

SpinInfo aSpinAt(DateTime startAt) => SpinInfo(
  startAt: startAt,
  duration: const Duration(seconds: 5),
  doors: const [3, 0, 5, 1, 2, 4, 6],
  winnerIndex: 1,
  by: 'member',
);

class FakeTodayRepository implements TodayRepository {
  FakeTodayRepository(this.next);

  Today next;
  Object? error;
  int reads = 0;
  int spins = 0;

  /// Answers for successive reads; the last one repeats.
  List<Today> script = const [];

  @override
  Future<Today> today(String groupId) async {
    reads++;
    if (error != null) {
      throw error!;
    }
    if (script.isNotEmpty) {
      return script[(reads - 1).clamp(0, script.length - 1)];
    }
    return next;
  }

  @override
  Future<void> spin(String groupId) async {
    spins++;
    if (error != null) {
      throw error!;
    }
  }
}
