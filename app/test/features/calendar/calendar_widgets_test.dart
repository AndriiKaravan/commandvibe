import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/calendar_editor_view.dart';
import 'package:commandvibe/features/calendar/ui/calendar_editor_view_model.dart';
import 'package:commandvibe/features/calendar/ui/game_setup_view.dart';
import 'package:commandvibe/features/calendar/ui/game_setup_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_calendar_repository.dart';

Widget app(Widget child, {Locale locale = const Locale('uk')}) => MaterialApp(
  locale: locale,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: child),
);

void main() {
  group('GameSetupBody', () {
    late GameSetupViewModel viewModel;

    setUp(() {
      viewModel = GameSetupViewModel(
        FakeCalendarRepository(aCalendar()),
        groupId: 'g1',
        clock: () => DateTime(2026, 11, 28),
      );
    });

    testWidgets('should offer every category as a chip and toggle it', (
      tester,
    ) async {
      await tester.pumpWidget(
        app(
          GameSetupBody(
            viewModel: viewModel,
            onPickDate: () {},
            onPickTime: () {},
          ),
        ),
      );
      expect(
        find.byType(FilterChip),
        findsNWidgets(GameCategory.values.length),
      );
      final kids = find.byKey(const Key('category-kids'));
      final selectedBefore = viewModel.categories.contains(GameCategory.kids);
      await tester.ensureVisible(kids);
      await tester.tap(kids);
      await tester.pump();
      expect(
        viewModel.categories.contains(GameCategory.kids),
        isNot(selectedBefore),
      );
    });

    testWidgets('should disable saving and say why when the form is wrong', (
      tester,
    ) async {
      viewModel.setDays(3);
      await tester.pumpWidget(
        app(
          GameSetupBody(
            viewModel: viewModel,
            onPickDate: () {},
            onPickTime: () {},
          ),
        ),
      );
      final save = tester.widget<FilledButton>(
        find.byKey(const Key('save-game')),
      );
      expect(save.onPressed, isNull);
      expect(find.text('Тривалість — від 7 до 31 дня.'), findsOneWidget);
    });
  });

  group('CalendarEditorBody', () {
    late CalendarEditorViewModel viewModel;

    setUp(() async {
      viewModel = CalendarEditorViewModel(
        FakeCalendarRepository(aCalendar(days: 7, open: {0, 1})),
        groupId: 'g1',
      );
      await viewModel.load();
    });

    Widget editor({Locale locale = const Locale('uk')}) => app(
      CalendarEditorBody(
        viewModel: viewModel,
        onPickTask: (_) {},
        onWriteOwn: (_) {},
        onSetup: () {},
      ),
      locale: locale,
    );

    testWidgets('should give controls only to days that have not opened', (
      tester,
    ) async {
      await tester.pumpWidget(editor());
      for (final key in ['other', 'pick', 'own']) {
        expect(find.byKey(Key('$key-0')), findsNothing);
        expect(find.byKey(Key('$key-1')), findsNothing);
        expect(find.byKey(Key('$key-2')), findsOneWidget);
      }
      // Day 1 has opened, so day 2 cannot swap upward; day 3 can both ways.
      expect(find.byKey(const Key('up-2')), findsNothing);
      expect(find.byKey(const Key('down-2')), findsOneWidget);
      expect(find.byKey(const Key('up-3')), findsOneWidget);
      expect(find.byKey(const Key('down-6')), findsNothing);
    });

    testWidgets('should show the task in the language of the app', (
      tester,
    ) async {
      await tester.pumpWidget(editor());
      expect(find.text('Завдання t2'), findsOneWidget);
      await tester.pumpWidget(editor(locale: const Locale('en')));
      await tester.pump();
      expect(find.text('Task t2'), findsOneWidget);
    });

    testWidgets('should call the server when "Other" is tapped', (
      tester,
    ) async {
      await tester.pumpWidget(editor());
      await tester.ensureVisible(find.byKey(const Key('other-3')));
      await tester.tap(find.byKey(const Key('other-3')));
      await tester.pump();
      await tester.pump();
      expect(find.text('Завдання other3'), findsOneWidget);
    });
  });
}
