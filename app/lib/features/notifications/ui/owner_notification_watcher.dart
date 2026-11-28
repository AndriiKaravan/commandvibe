import 'dart:async';

import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:ks_core/ks_core.dart';

/// The organizer's service entries (a member waiting, a complaint) arrive on the owner topic,
/// not the group one; this calls [onChange] when one is created or read.
class OwnerNotificationWatcher {
  OwnerNotificationWatcher(
    RealtimeClient realtime, {
    required String groupId,
    required void Function() onChange,
  }) {
    final subscription = _subscription = realtime.subscribe('org:$groupId');
    _events = subscription.events
        .where((event) => notificationEvents.contains(event.type))
        .listen((_) => onChange());
  }

  late final StreamSubscription<RealtimeEvent> _events;
  late final RealtimeSubscription _subscription;

  void dispose() {
    unawaited(_events.cancel());
    _subscription.cancel();
  }
}
