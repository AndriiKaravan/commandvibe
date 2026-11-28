import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('GameProgress', () {
    test('should read days, the current day and the own flag', () {
      final progress = GameProgress.fromJson({
        'currentDay': 1,
        'serverTime': '2026-12-02T10:00:00.000Z',
        'days': [
          {'dayIndex': 0, 'done': 2, 'total': 3, 'mine': true},
          {'dayIndex': 1, 'done': 0, 'total': 3, 'mine': null},
        ],
      });

      expect(progress.currentDay, 1);
      expect(progress.days[0].mine, isTrue);
      expect(progress.days[1].mine, isNull);
      expect(progress.dayOf(1)?.total, 3);
      expect(progress.dayOf(9), isNull);
    });

    test('should have no current day before the first opens', () {
      final progress = GameProgress.fromJson({
        'serverTime': '2026-12-02T10:00:00.000Z',
        'days': const [],
      });

      expect(progress.currentDay, isNull);
      expect(progress.current, isNull);
    });
  });

  group('DayProgress', () {
    test('should compute the share done and whether the goal is reached', () {
      const day = DayProgress(dayIndex: 0, done: 8, total: 10, mine: false);

      expect(day.share, 0.8);
      expect(day.goalReached, isTrue);
      expect(
        const DayProgress(
          dayIndex: 0,
          done: 7,
          total: 10,
          mine: false,
        ).goalReached,
        isFalse,
      );
    });

    test('should not divide by zero with nobody playing', () {
      const day = DayProgress(dayIndex: 0, done: 0, total: 0, mine: null);

      expect(day.share, 0);
      expect(day.goalReached, isFalse);
    });
  });
}
