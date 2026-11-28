import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

enum GameEventKind { photoSent, dayOpened, photosRevealed }

@immutable
class GameEvent {
  const GameEvent({
    required this.kind,
    required this.at,
    this.name,
    this.dayIndex,
  });

  final GameEventKind kind;
  final DateTime at;
  final String? name;
  final int? dayIndex;
}

/// What happened in the group while the app was open; the server keeps no event log.
class EventsViewModel extends ChangeNotifier {
  EventsViewModel(
    this._realtime, {
    required this.groupId,
    required this.nameOf,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  static const maxEvents = 20;

  final RealtimeClient _realtime;
  final String groupId;

  /// Display name of a member id, or null when it is not known (yet).
  final String? Function(String memberId) nameOf;
  final DateTime Function() _clock;

  final List<GameEvent> _events = [];
  StreamSubscription<RealtimeEvent>? _listener;
  RealtimeSubscription? _subscription;
  bool _disposed = false;

  /// Newest first.
  List<GameEvent> get events => List.unmodifiable(_events);

  void start() {
    final subscription = _subscription = _realtime.subscribe('group:$groupId');
    _listener = subscription.events.listen(_onEvent);
  }

  void _onEvent(RealtimeEvent event) {
    final dayIndex = _field(event, 'dayIndex');
    final day = dayIndex is int ? dayIndex : null;
    final GameEvent? made = switch (event.type) {
      'submission.created' => _photoSent(event, day),
      'day.opened' when day != null => GameEvent(
        kind: GameEventKind.dayOpened,
        at: _clock(),
        dayIndex: day,
      ),
      'photos.revealed' when day != null => GameEvent(
        kind: GameEventKind.photosRevealed,
        at: _clock(),
        dayIndex: day,
      ),
      _ => null,
    };
    if (made == null || _disposed) {
      return;
    }
    _events.insert(0, made);
    if (_events.length > maxEvents) {
      _events.removeRange(maxEvents, _events.length);
    }
    notifyListeners();
  }

  /// A payload field, or null when the payload is not a map.
  Object? _field(RealtimeEvent event, String key) {
    final data = event.data;
    return data is Map ? data[key] : null;
  }

  GameEvent? _photoSent(RealtimeEvent event, int? day) {
    final memberId = _field(event, 'memberId');
    final name = memberId is String ? nameOf(memberId) : null;
    if (name == null) {
      return null;
    }
    return GameEvent(
      kind: GameEventKind.photoSent,
      at: _clock(),
      name: name,
      dayIndex: day,
    );
  }

  @override
  void dispose() {
    _disposed = true;
    _listener?.cancel();
    _subscription?.cancel();
    super.dispose();
  }
}
