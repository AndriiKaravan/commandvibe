import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/today/data/today_models.dart';
import 'package:commandvibe/features/today/data/today_repository.dart';
import 'package:commandvibe/features/today/ui/roulette_motion.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

sealed class TodayState {
  const TodayState();
}

class TodayLoading extends TodayState {
  const TodayLoading();
}

class TodayNotConfigured extends TodayState {
  const TodayNotConfigured();
}

class TodayBeforeStart extends TodayState {
  const TodayBeforeStart({required this.opensAt});

  final DateTime opensAt;
}

/// The roulette waits for [pickerMemberId]; [isMyTurn] tells the viewer to spin.
class TodayWaiting extends TodayState {
  const TodayWaiting({
    required this.dayIndex,
    required this.pickerMemberId,
    required this.deadline,
    required this.isMyTurn,
  });

  final int dayIndex;
  final String? pickerMemberId;
  final DateTime? deadline;
  final bool isMyTurn;
}

/// The wheel is turning (or replaying for a late joiner); the task stays hidden until it stops.
class TodaySpinning extends TodayState {
  const TodaySpinning({
    required this.dayIndex,
    required this.motion,
    required this.doors,
  });

  final int dayIndex;
  final RouletteMotion motion;
  final List<int> doors;
}

/// The day is open; [task] is null while the server still holds it back.
class TodayOpen extends TodayState {
  const TodayOpen({required this.dayIndex, required this.task});

  final int dayIndex;
  final TaskItem? task;
}

class TodayFinished extends TodayState {
  const TodayFinished({required this.task});

  final TaskItem? task;
}

enum TodayMessage { turnOver, failed }

/// The "Today" card: today's task, or the roulette that picks it, kept live over the group topic.
class TodayViewModel extends ChangeNotifier {
  TodayViewModel(
    this._repository,
    this._realtime, {
    required this.groupId,
    DateTime Function()? clock,
    this.settle = const Duration(milliseconds: 300),
  }) : _clock = clock ?? DateTime.now;

  static const _maxSettleTries = 3;

  final TodayRepository _repository;
  final RealtimeClient _realtime;
  final String groupId;
  final DateTime Function() _clock;

  /// Pause before reading the task once the wheel has stopped, so the server's clock has caught up.
  final Duration settle;

  final List<StreamSubscription<void>> _listeners = [];
  RealtimeSubscription? _subscription;
  Today? _today;
  Duration _serverOffset = Duration.zero;
  final Set<int> _animationDone = {};
  RouletteMotion? _motion;
  int? _motionDay;
  TodayState _state = const TodayLoading();
  bool _loadFailed = false;
  TodayMessage? _message;
  bool _disposed = false;

  TodayState get state => _state;
  bool get loadFailed => _loadFailed;
  TodayMessage? get message => _message;

  void start() {
    final subscription = _subscription = _realtime.subscribe('group:$groupId');
    // The first resync loads the day; later events and resyncs cover whatever changed or was missed offline.
    _listeners
      ..add(subscription.resyncs.listen((_) => _load()))
      ..add(subscription.events.listen((_) => _load()));
  }

  /// The chosen member spins the wheel.
  Future<void> spin() async {
    _message = null;
    notifyListeners();
    try {
      await _repository.spin(groupId);
    } on ApiException catch (failure) {
      _message = failure.statusCode == 403 || failure.statusCode == 409
          ? TodayMessage.turnOver
          : TodayMessage.failed;
    } on NetworkException {
      _message = TodayMessage.failed;
    }
    await _load();
  }

  /// The wheel stopped: show the task, reading it again while the server still holds it back.
  Future<void> animationFinished() async {
    final index = _today?.day?.day.dayIndex;
    if (index == null) {
      return;
    }
    _animationDone.add(index);
    _derive();
    notifyListeners();
    for (var attempt = 0; attempt < _maxSettleTries; attempt++) {
      if (settle > Duration.zero) {
        await Future<void>.delayed(settle);
      }
      await _load();
      final state = _state;
      if (state is! TodayOpen || state.task != null) {
        return;
      }
    }
  }

  Future<void> _load() async {
    try {
      final today = await _repository.today(groupId);
      if (_disposed) {
        return;
      }
      _today = today;
      _serverOffset = today.serverTime.difference(_clock());
      _loadFailed = false;
      _derive();
    } on ApiException {
      _loadFailed = true;
    } on NetworkException {
      _loadFailed = true;
    }
    if (!_disposed) {
      notifyListeners();
    }
  }

  void _derive() {
    final today = _today;
    if (today == null) {
      return;
    }
    final entry = today.day;
    _state = switch (today.status) {
      TodayStatus.notConfigured => const TodayNotConfigured(),
      TodayStatus.beforeStart => TodayBeforeStart(
        opensAt: entry?.day.opensAt ?? today.serverTime,
      ),
      TodayStatus.finished => TodayFinished(task: entry?.day.task),
      TodayStatus.active =>
        entry == null ? const TodayNotConfigured() : _activeState(entry),
    };
  }

  TodayState _activeState(TodayDay entry) {
    final index = entry.day.dayIndex;
    if (entry.day.state == DayState.picking) {
      return TodayWaiting(
        dayIndex: index,
        pickerMemberId: entry.pickerMemberId,
        deadline: entry.pickDeadlineAt,
        isMyTurn: entry.isMyTurn ?? false,
      );
    }
    final spin = entry.spin;
    if (spin != null && !_animationDone.contains(index)) {
      // Keep one motion per day so a reload does not restart the animation.
      if (_motionDay != index) {
        _motion = RouletteMotion.from(
          spin: spin,
          localNow: _clock(),
          serverOffset: _serverOffset,
        );
        _motionDay = index;
      }
      return TodaySpinning(
        dayIndex: index,
        motion: _motion!,
        doors: spin.doors,
      );
    }
    return TodayOpen(dayIndex: index, task: entry.day.task);
  }

  @override
  void dispose() {
    _disposed = true;
    for (final listener in _listeners) {
      listener.cancel();
    }
    _subscription?.cancel();
    super.dispose();
  }
}
