import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/today/data/today_models.dart';
import 'package:commandvibe/features/today/ui/roulette_wheel.dart';
import 'package:commandvibe/features/today/ui/today_card.dart';
import 'package:commandvibe/features/today/ui/today_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/testing.dart';

import 'fake_today_repository.dart';

Widget app(Widget child, {Locale locale = const Locale('uk')}) => MaterialApp(
  locale: locale,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  group('TodayCardBody', () {
    late FakeTodayRepository repository;
    late FakeRealtimeClient realtime;
    late TodayViewModel viewModel;

    TodayViewModel create() => TodayViewModel(
      repository,
      realtime,
      groupId: 'g1',
      // The phone's clock agrees with the server's.
      clock: () => serverNow,
      settle: Duration.zero,
    );

    setUp(() {
      realtime = FakeRealtimeClient();
    });

    Future<void> show(
      WidgetTester tester, {
      Locale locale = const Locale('uk'),
    }) async {
      viewModel = create()..start();
      await tester.pumpWidget(
        app(TodayCardBody(viewModel: viewModel), locale: locale),
      );
      await tester.pump();
      await tester.pump();
    }

    tearDown(() => viewModel.dispose());

    testWidgets('should show the task of the day in the app language', (
      tester,
    ) async {
      repository = FakeTodayRepository(aToday());
      await show(tester);
      expect(find.text('Сніговик'), findsOneWidget);
      expect(find.text('Зліпи сніговика'), findsOneWidget);
      viewModel.dispose();
      await show(tester, locale: const Locale('en'));
      await tester.pumpAndSettle();
      expect(find.text('Snowman'), findsOneWidget);
    });

    testWidgets('should offer the spin only to the chosen member', (
      tester,
    ) async {
      repository = FakeTodayRepository(
        aToday(
          state: DayState.picking,
          pickerMemberId: 'm1',
          isMyTurn: true,
          pickDeadlineAt: DateTime.utc(2026, 12, 1, 10),
        ),
      );
      await show(tester);
      expect(find.byKey(const Key('spin-button')), findsOneWidget);
      await tester.tap(find.byKey(const Key('spin-button')));
      await tester.pump();
      expect(repository.spins, 1);
    });

    testWidgets('should tell the others that someone else is spinning', (
      tester,
    ) async {
      repository = FakeTodayRepository(
        aToday(
          state: DayState.picking,
          pickerMemberId: 'm1',
          isMyTurn: false,
          pickDeadlineAt: DateTime.utc(2026, 12, 1, 10),
        ),
      );
      await show(tester);
      expect(find.byKey(const Key('spin-button')), findsNothing);
      expect(
        find.textContaining('Рулетку крутить інший гравець'),
        findsOneWidget,
      );
    });

    testWidgets('should turn the wheel and then reveal the task', (
      tester,
    ) async {
      final spin = aSpinAt(serverNow.subtract(const Duration(seconds: 1)));
      repository = FakeTodayRepository(aToday())
        ..script = [aToday(withTask: false, spin: spin), aToday(spin: spin)];
      await show(tester);
      expect(find.byType(RouletteWheel), findsOneWidget);
      expect(find.text('Сніговик'), findsNothing);
      // 4 s of the 5 s spin are left; the task appears once the wheel has stopped.
      await tester.pump(const Duration(seconds: 5));
      await tester.pump();
      await tester.pump();
      expect(find.byType(RouletteWheel), findsNothing);
      expect(find.text('Сніговик'), findsOneWidget);
    });

    testWidgets('should wait for a spin that has not started yet', (
      tester,
    ) async {
      final spin = aSpinAt(serverNow.add(const Duration(seconds: 2)));
      repository = FakeTodayRepository(aToday(withTask: false, spin: spin));
      await show(tester);
      expect(find.byType(RouletteWheel), findsOneWidget);
      // The wheel idles for the 2 s lead, then needs a frame to start and 5 s to stop.
      await tester.pump(const Duration(seconds: 2));
      await tester.pump();
      expect(repository.reads, 1, reason: 'not finished yet');
      // The controller completes only once elapsed time passes the duration.
      await tester.pump(const Duration(milliseconds: 5100));
      await tester.pump();
      expect(repository.reads, greaterThanOrEqualTo(2));
    });

    testWidgets('should explain the quiet stages', (tester) async {
      repository = FakeTodayRepository(
        aToday(status: TodayStatus.notConfigured),
      );
      await show(tester);
      expect(find.text('Гру ще не налаштовано.'), findsOneWidget);

      repository.next = aToday(
        status: TodayStatus.beforeStart,
        state: DayState.closed,
      );
      realtime.emit(eventOf('day.opened'));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('Гра починається'), findsOneWidget);

      repository.next = aToday(status: TodayStatus.finished);
      realtime.emit(eventOf('game.finished'));
      await tester.pump();
      await tester.pump();
      expect(find.textContaining('Гру завершено'), findsOneWidget);
    });
  });
}
