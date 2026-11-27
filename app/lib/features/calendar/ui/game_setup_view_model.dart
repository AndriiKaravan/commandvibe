import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/data/calendar_repository.dart';
import 'package:flutter/foundation.dart';

enum SetupError { startInPast, invalidDays, noCategories, gameStarted, failed }

/// The organizer's game form: when it starts, how long, how tasks are picked.
class GameSetupViewModel extends ChangeNotifier {
  GameSetupViewModel(
    this._repository, {
    required this.groupId,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now {
    final today = _clock();
    startDate = DateTime(today.year, today.month, today.day);
  }

  static const minDays = 7;
  static const maxDays = 31;

  final CalendarRepository _repository;
  final String groupId;
  final DateTime Function() _clock;

  late DateTime startDate;
  int days = 14;
  String openTime = '09:00';
  GameMode mode = GameMode.auto;
  final Set<GameCategory> _categories = {
    GameCategory.home,
    GameCategory.street,
    GameCategory.cheap,
    GameCategory.team,
  };
  bool _busy = false;
  SetupError? _error;
  Calendar? _saved;

  Set<GameCategory> get categories => Set.unmodifiable(_categories);
  bool get isBusy => _busy;
  SetupError? get error => _error;

  /// The calendar the server drew once the game is saved.
  Calendar? get saved => _saved;

  /// What is wrong with the form right now, if anything.
  SetupError? get problem {
    final today = _clock();
    if (days < minDays || days > maxDays) {
      return SetupError.invalidDays;
    }
    if (startDate.isBefore(DateTime(today.year, today.month, today.day))) {
      return SetupError.startInPast;
    }
    if (_categories.isEmpty) {
      return SetupError.noCategories;
    }
    return null;
  }

  bool get canSubmit => problem == null && !_busy;

  void setDays(int value) {
    days = value;
    _changed();
  }

  void setStartDate(DateTime value) {
    startDate = value;
    _changed();
  }

  void setOpenTime(String value) {
    openTime = value;
    _changed();
  }

  void setMode(GameMode value) {
    mode = value;
    _changed();
  }

  void toggleCategory(GameCategory category) {
    if (!_categories.remove(category)) {
      _categories.add(category);
    }
    _changed();
  }

  Future<void> submit() async {
    final wrong = problem;
    if (wrong != null) {
      _error = wrong;
      notifyListeners();
      return;
    }
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      _saved = await _repository.saveGame(
        groupId,
        GameSetup(
          startDate: startDate,
          days: days,
          openTime: openTime,
          mode: mode,
          categories: Set.of(_categories),
        ),
      );
    } on ApiException catch (failure) {
      _error = switch (failure.code) {
        'game_started' => SetupError.gameStarted,
        'start_in_past' => SetupError.startInPast,
        _ => SetupError.failed,
      };
    } on NetworkException {
      _error = SetupError.failed;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  void _changed() {
    _error = null;
    notifyListeners();
  }
}
