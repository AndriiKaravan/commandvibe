import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/features/progress/ui/day_progress_card.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pump(WidgetTester tester, DayProgress? day) => tester.pumpWidget(
  MaterialApp(
    locale: const Locale('uk'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: DayProgressCard(day: day)),
  ),
);

void main() {
  group('DayProgressCard', () {
    testWidgets('should show how many have done the task', (tester) async {
      await _pump(
        tester,
        const DayProgress(dayIndex: 0, done: 7, total: 12, mine: false),
      );

      expect(find.text('7 з 12 уже виконали'), findsOneWidget);
      final bar = tester.widget<LinearProgressIndicator>(
        find.byType(LinearProgressIndicator),
      );
      expect(bar.value, closeTo(7 / 12, 0.001));
      expect(find.textContaining('80%'), findsOneWidget);
    });

    testWidgets('should celebrate once the shared goal is reached', (
      tester,
    ) async {
      await _pump(
        tester,
        const DayProgress(dayIndex: 0, done: 10, total: 12, mine: true),
      );

      expect(find.byKey(const Key('goal-reached')), findsOneWidget);
    });

    testWidgets('should start from zero', (tester) async {
      await _pump(
        tester,
        const DayProgress(dayIndex: 0, done: 0, total: 5, mine: false),
      );

      expect(find.text('0 з 5 уже виконали'), findsOneWidget);
      expect(find.byKey(const Key('goal-reached')), findsNothing);
    });

    testWidgets('should draw nothing with nobody playing or no open day', (
      tester,
    ) async {
      await _pump(
        tester,
        const DayProgress(dayIndex: 0, done: 0, total: 0, mine: null),
      );
      expect(find.byType(LinearProgressIndicator), findsNothing);

      await _pump(tester, null);
      expect(find.byType(LinearProgressIndicator), findsNothing);
    });
  });
}
