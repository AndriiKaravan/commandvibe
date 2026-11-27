import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/game_setup_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_calendar_repository.dart';

void main() {
  group('GameSetupViewModel', () {
    late FakeCalendarRepository repository;
    late GameSetupViewModel viewModel;
    // 28 Nov 2026, local time.
    final today = DateTime(2026, 11, 28, 15);

    setUp(() {
      repository = FakeCalendarRepository(aCalendar());
      viewModel = GameSetupViewModel(
        repository,
        groupId: 'g1',
        clock: () => today,
      );
    });

    test('should start with a two-week auto game from today at 09:00', () {
      expect(viewModel.days, 14);
      expect(viewModel.openTime, '09:00');
      expect(viewModel.mode, GameMode.auto);
      expect(viewModel.startDate, DateTime(2026, 11, 28));
      expect(viewModel.categories, isNotEmpty);
      expect(viewModel.problem, isNull);
      expect(viewModel.canSubmit, isTrue);
    });

    test('should accept 7 to 31 days and nothing else', () {
      for (final ok in [7, 14, 31]) {
        viewModel.setDays(ok);
        expect(viewModel.problem, isNull, reason: '$ok days');
      }
      for (final bad in [6, 32, 0, -3]) {
        viewModel.setDays(bad);
        expect(viewModel.problem, SetupError.invalidDays, reason: '$bad days');
        expect(viewModel.canSubmit, isFalse);
      }
    });

    test('should refuse a start date before today but accept today', () {
      viewModel.setStartDate(DateTime(2026, 11, 27, 23, 59));
      expect(viewModel.problem, SetupError.startInPast);
      viewModel.setStartDate(DateTime(2026, 11, 28, 0, 1));
      expect(viewModel.problem, isNull);
    });

    test('should need at least one category and toggle them', () {
      for (final category in viewModel.categories.toList()) {
        viewModel.toggleCategory(category);
      }
      expect(viewModel.problem, SetupError.noCategories);
      viewModel.toggleCategory(GameCategory.kids);
      expect(viewModel.categories, {GameCategory.kids});
      expect(viewModel.problem, isNull);
    });

    test('should not call the server while the form is invalid', () async {
      viewModel.setDays(3);
      await viewModel.submit();
      expect(repository.calls, isEmpty);
      expect(viewModel.error, SetupError.invalidDays);
    });

    test('should save the game and expose the drawn calendar', () async {
      viewModel
        ..setDays(10)
        ..setMode(GameMode.roulette)
        ..setOpenTime('08:30');
      await viewModel.submit();
      expect(repository.savedSetup?.days, 10);
      expect(repository.savedSetup?.mode, GameMode.roulette);
      expect(repository.savedSetup?.openTime, '08:30');
      expect(viewModel.saved, isNotNull);
      expect(viewModel.error, isNull);
      expect(viewModel.isBusy, isFalse);
    });

    test('should explain a game that has already started', () async {
      repository.error = ApiException(409, code: 'game_started');
      await viewModel.submit();
      expect(viewModel.error, SetupError.gameStarted);
      expect(viewModel.saved, isNull);
    });

    test('should map any other failure to a generic error', () async {
      repository.error = NetworkException('offline');
      await viewModel.submit();
      expect(viewModel.error, SetupError.failed);
    });
  });
}
