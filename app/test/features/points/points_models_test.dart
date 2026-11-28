import 'package:commandvibe/features/points/data/points_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PointsJournal', () {
    test('should read the total and every entry with its kind', () {
      final journal = PointsJournal.fromJson({
        'total': 21,
        'entries': [
          {'dayIndex': 0, 'kind': 'done', 'amount': 10},
          {'dayIndex': 0, 'kind': 'speed', 'amount': 5, 'detail': 1},
          {'dayIndex': 1, 'kind': 'late', 'amount': -2, 'detail': 1},
          {'dayIndex': 1, 'kind': 'sympathy', 'amount': 4, 'detail': 3},
          {'dayIndex': 1, 'kind': 'goal', 'amount': 3},
        ],
      });

      expect(journal.total, 21);
      expect(journal.entries.map((e) => e.kind), [
        PointKind.done,
        PointKind.speed,
        PointKind.late,
        PointKind.sympathy,
        PointKind.goal,
      ]);
      expect(journal.entries[1].detail, 1);
      expect(journal.entries[2].amount, -2);
      expect(journal.entries[0].detail, isNull);
    });

    test('should survive a kind it does not know yet', () {
      final journal = PointsJournal.fromJson({
        'total': 2,
        'entries': [
          {'dayIndex': 0, 'kind': 'joker', 'amount': 2},
        ],
      });

      expect(journal.entries.single.kind, PointKind.other);
      expect(journal.entries.single.amount, 2);
    });

    test('should be empty for a player without points', () {
      final journal = PointsJournal.fromJson({'total': 0, 'entries': const []});

      expect(journal.entries, isEmpty);
      expect(journal.total, 0);
    });
  });
}
