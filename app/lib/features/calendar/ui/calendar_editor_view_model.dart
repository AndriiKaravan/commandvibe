import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/data/calendar_repository.dart';
import 'package:flutter/foundation.dart';

enum EditorMessage { dayOpened, noMoreTasks, taskInGame, failed }

/// The organizer's calendar: change the task of any day that has not opened yet.
class CalendarEditorViewModel extends ChangeNotifier {
  CalendarEditorViewModel(this._repository, {required this.groupId});

  final CalendarRepository _repository;
  final String groupId;

  Calendar? _calendar;
  bool _loading = true;
  bool _loadFailed = false;
  bool _busy = false;
  EditorMessage? _message;

  Calendar? get calendar => _calendar;
  bool get isLoading => _loading;
  bool get loadFailed => _loadFailed;
  bool get isBusy => _busy;

  /// Why the last action did not happen; cleared by the next one.
  EditorMessage? get message => _message;

  Future<void> load() async {
    _loading = true;
    notifyListeners();
    try {
      _calendar = await _repository.calendar(groupId);
      _loadFailed = false;
    } on Exception {
      _loadFailed = true;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> other(int day) => _edit(() async {
    _replaceDay(await _repository.other(groupId, day));
  });

  Future<void> chooseTask(int day, String taskId) => _edit(() async {
    _replaceDay(await _repository.setCatalogTask(groupId, day, taskId));
  });

  Future<void> writeOwn(int day, CustomTask task) => _edit(() async {
    _replaceDay(await _repository.setCustomTask(groupId, day, task));
  });

  bool canMoveUp(int day) => _canSwap(day, day - 1);

  bool canMoveDown(int day) => _canSwap(day, day + 1);

  Future<void> moveUp(int day) => _move(day, day - 1);

  Future<void> moveDown(int day) => _move(day, day + 1);

  bool _canSwap(int day, int to) {
    final days = _calendar?.days;
    if (days == null || to < 0 || to >= days.length || day >= days.length) {
      return false;
    }
    return days[day].isEditable && days[to].isEditable;
  }

  Future<void> _move(int day, int to) => _edit(() async {
    if (_canSwap(day, to)) {
      _calendar = await _repository.move(groupId, day, to);
    }
  });

  void _replaceDay(CalendarDay replaced) {
    final current = _calendar;
    if (current == null) {
      return;
    }
    _calendar = Calendar(
      game: current.game,
      days: [
        for (final day in current.days)
          day.dayIndex == replaced.dayIndex ? replaced : day,
      ],
      serverTime: current.serverTime,
    );
  }

  /// Runs an edit; a refusal becomes a [message], and a day that opened meanwhile reloads the page.
  Future<void> _edit(Future<void> Function() action) async {
    _message = null;
    _busy = true;
    notifyListeners();
    var reload = false;
    try {
      await action();
    } on ApiException catch (failure) {
      _message = switch (failure.code) {
        'day_opened' => EditorMessage.dayOpened,
        'no_more_tasks' => EditorMessage.noMoreTasks,
        'task_in_game' => EditorMessage.taskInGame,
        _ => EditorMessage.failed,
      };
      reload = failure.code == 'day_opened';
    } on NetworkException {
      _message = EditorMessage.failed;
    }
    _busy = false;
    notifyListeners();
    if (reload) {
      await load();
    }
  }
}
