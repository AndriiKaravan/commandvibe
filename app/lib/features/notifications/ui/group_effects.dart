import 'dart:async';

import 'package:commandvibe/features/notifications/ui/live_effects.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// Turns the group's live events into toasts and tab dots for the person using the app.
class GroupEffects extends ChangeNotifier {
  GroupEffects(
    this._realtime, {
    required this.groupId,
    required this.selfMemberId,
    required this.currentTab,
    required this.onToast,
  });

  final RealtimeClient _realtime;
  final String groupId;

  /// The member this person plays as; null for an organizer who does not play.
  final String? selfMemberId;
  final int Function() currentTab;
  final void Function(LiveToast toast) onToast;

  final Set<int> _dots = {};
  StreamSubscription<RealtimeEvent>? _events;
  RealtimeSubscription? _subscription;
  bool _disposed = false;

  Set<int> get dots => Set.unmodifiable(_dots);

  void start() {
    final subscription = _subscription = _realtime.subscribe('group:$groupId');
    _events = subscription.events.listen(_onEvent);
  }

  void _onEvent(RealtimeEvent event) {
    if (_disposed) {
      return;
    }
    final data = event.data;
    final effect = liveEffectOf(
      event.type,
      data is Map ? Map<String, dynamic>.from(data) : const {},
      selfMemberId: selfMemberId,
    );
    if (effect == null) {
      return;
    }
    final tab = effect.dotTab;
    if (tab != null && tab != currentTab() && _dots.add(tab)) {
      notifyListeners();
    }
    final toast = effect.toast;
    if (toast != null) {
      onToast(toast);
    }
  }

  /// The person opened [tab]; its dot has done its job.
  void select(int tab) {
    if (_dots.remove(tab)) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    if (_disposed) {
      return;
    }
    _disposed = true;
    unawaited(_events?.cancel());
    _subscription?.cancel();
    super.dispose();
  }
}
