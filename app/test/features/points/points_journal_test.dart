import 'package:commandvibe/features/points/data/points_models.dart';
import 'package:commandvibe/features/points/ui/journal_groups.dart';
import 'package:commandvibe/features/points/ui/points_journal_view.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

PointEntry _e(int day, PointKind kind, int amount, [int? detail]) =>
    PointEntry(dayIndex: day, kind: kind, amount: amount, detail: detail);

Widget _app(Widget child) => MaterialApp(
  locale: const Locale('uk'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  group('groupJournal', () {
    test(
      'should put the entries of each day together with a subtotal, in day order',
      () {
        final days = groupJournal([
          _e(1, PointKind.done, 10),
          _e(0, PointKind.done, 10),
          _e(0, PointKind.speed, 5, 1),
          _e(1, PointKind.late, -2, 1),
        ]);

        expect(days.map((d) => d.dayIndex), [0, 1]);
        expect(days[0].entries.map((e) => e.kind), [
          PointKind.done,
          PointKind.speed,
        ]);
        expect(days[0].subtotal, 15);
        expect(days[1].subtotal, 8);
      },
    );

    test('should give nothing for an empty journal', () {
      expect(groupJournal(const []), isEmpty);
    });

    test('should keep the order of the entries inside a day as given', () {
      final days = groupJournal([
        _e(0, PointKind.goal, 3),
        _e(0, PointKind.done, 10),
      ]);

      expect(days.single.entries.map((e) => e.kind), [
        PointKind.goal,
        PointKind.done,
      ]);
    });
  });

  group('PointsJournalList', () {
    testWidgets('should say where each number comes from', (tester) async {
      await tester.pumpWidget(
        _app(
          PointsJournalList(
            journal: PointsJournal(
              total: 23,
              entries: [
                _e(0, PointKind.done, 10),
                _e(0, PointKind.speed, 5, 1),
                _e(0, PointKind.goal, 3),
                _e(1, PointKind.late, -2, 1),
                _e(1, PointKind.sympathy, 4, 3),
              ],
            ),
          ),
        ),
      );

      expect(find.text('День 1'), findsOneWidget);
      expect(find.text('День 2'), findsOneWidget);
      expect(find.text('Виконано'), findsOneWidget);
      expect(find.text('Швидкість · 1-й'), findsOneWidget);
      expect(find.text('Спільна ціль'), findsOneWidget);
      expect(find.text('Пізно · 1 дн.'), findsOneWidget);
      expect(find.text('Симпатії · лайків: 3'), findsOneWidget);
      expect(find.text('+10'), findsOneWidget);
      expect(find.text('−2'), findsOneWidget);
      expect(find.text('Разом: 23 б.'), findsOneWidget);
    });

    testWidgets('should say there are no points yet', (tester) async {
      await tester.pumpWidget(
        _app(
          const PointsJournalList(
            journal: PointsJournal(total: 0, entries: []),
          ),
        ),
      );

      expect(find.text('Поки без балів'), findsOneWidget);
    });

    testWidgets('should not break on a kind it does not know', (tester) async {
      await tester.pumpWidget(
        _app(
          PointsJournalList(
            journal: PointsJournal(
              total: 2,
              entries: [_e(0, PointKind.other, 2)],
            ),
          ),
        ),
      );

      expect(find.text('Інше'), findsOneWidget);
    });
  });
}
