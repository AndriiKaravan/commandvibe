import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/day_state.dart';
import 'package:commandvibe/features/calendar/ui/doors_grid.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

final _reveal = DateTime.utc(2026, 12, 3, 7);

void main() {
  group('dayCellState', () {
    DayCellState state(DayState day, bool? mine, DateTime now) =>
        dayCellState(state: day, mine: mine, now: now, revealAt: _reveal);

    final before = _reveal.subtract(const Duration(hours: 1));

    test('should keep a day that has not opened closed', () {
      expect(state(DayState.closed, false, before), DayCellState.closed);
      expect(state(DayState.picking, false, before), DayCellState.closed);
    });

    test('should offer an open day the player has not done', () {
      expect(state(DayState.open, false, before), DayCellState.canStillDo);
    });

    test(
      'should still offer it after the reveal, late completion is allowed',
      () {
        expect(
          state(DayState.open, false, _reveal.add(const Duration(days: 1))),
          DayCellState.canStillDo,
        );
      },
    );

    test('should mark a done day until its photos open', () {
      expect(state(DayState.open, true, before), DayCellState.doneOnTime);
    });

    test('should switch to revealed exactly at the reveal time', () {
      expect(state(DayState.open, true, _reveal), DayCellState.revealed);
      expect(
        state(
          DayState.open,
          true,
          _reveal.subtract(const Duration(milliseconds: 1)),
        ),
        DayCellState.doneOnTime,
      );
    });

    test('should give an organizer who does not play no personal state', () {
      expect(state(DayState.open, null, before), DayCellState.open);
      expect(state(DayState.open, null, _reveal), DayCellState.revealed);
    });

    test('should treat a missing reveal time as not yet revealed', () {
      expect(
        dayCellState(
          state: DayState.open,
          mine: true,
          now: _reveal,
          revealAt: null,
        ),
        DayCellState.doneOnTime,
      );
    });
  });

  group('DoorsGrid', () {
    CalendarDay day(int index, DayState state) => CalendarDay(
      dayIndex: index,
      date: '2026-12-0${index + 1}',
      opensAt: DateTime.utc(2026, 12, index + 1, 7),
      state: state,
      revealAt: DateTime.utc(2026, 12, index + 3, 7),
    );

    Future<List<int>> pumpGrid(
      WidgetTester tester, {
      required List<CalendarDay> days,
      required GameProgress progress,
    }) async {
      final tapped = <int>[];
      tester.view.physicalSize = const Size(500, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('uk'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: DoorsGrid(
              days: days,
              progress: progress,
              now: DateTime.utc(2026, 12, 3, 10),
              onOpen: (d) => tapped.add(d.dayIndex),
            ),
          ),
        ),
      );
      return tapped;
    }

    GameProgress progress(Map<int, bool?> mine) => GameProgress(
      currentDay: 1,
      serverTime: DateTime.utc(2026, 12, 3, 10),
      days: [
        for (final entry in mine.entries)
          DayProgress(
            dayIndex: entry.key,
            done: 1,
            total: 2,
            mine: entry.value,
          ),
      ],
    );

    testWidgets('should draw a door for every day with its state', (
      tester,
    ) async {
      await pumpGrid(
        tester,
        days: [
          day(0, DayState.open),
          day(1, DayState.open),
          day(2, DayState.closed),
        ],
        progress: progress({0: true, 1: false, 2: false}),
      );

      expect(find.byKey(const Key('door-0')), findsOneWidget);
      expect(find.byKey(const Key('door-1')), findsOneWidget);
      expect(find.byKey(const Key('door-2')), findsOneWidget);
      expect(find.byIcon(Icons.lock), findsOneWidget);
      expect(find.byIcon(Icons.check_circle), findsNothing);
      expect(find.byIcon(Icons.photo_library), findsOneWidget);
      expect(find.byIcon(Icons.add_a_photo), findsOneWidget);
    });

    testWidgets('should not open a closed door', (tester) async {
      final tapped = await pumpGrid(
        tester,
        days: [day(0, DayState.closed)],
        progress: progress({0: false}),
      );

      await tester.tap(find.byKey(const Key('door-0')));

      expect(tapped, isEmpty);
    });

    testWidgets('should open an open door', (tester) async {
      final tapped = await pumpGrid(
        tester,
        days: [day(0, DayState.open)],
        progress: progress({0: false}),
      );

      await tester.tap(find.byKey(const Key('door-0')));

      expect(tapped, [0]);
    });
  });
}
