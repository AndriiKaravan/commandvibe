import 'package:ks_core/ks_core.dart';

/// Reports once the server withdraws this member's access to the group.
class AccessWatcher {
  AccessWatcher(
    this._realtime, {
    required this.groupId,
    required this.onRevoked,
  });

  final RealtimeClient _realtime;
  final String groupId;
  final void Function() onRevoked;

  RealtimeSubscription? _subscription;
  bool _disposed = false;

  void start() {
    final subscription = _subscription = _realtime.subscribe('group:$groupId');
    subscription.status.addListener(_onStatus);
  }

  void _onStatus() {
    final subscription = _subscription;
    if (_disposed || subscription == null) {
      return;
    }
    if (subscription.status.value == RealtimeSubscriptionStatus.denied &&
        subscription.deniedReason == 'revoked') {
      onRevoked();
    }
  }

  void dispose() {
    _disposed = true;
    _subscription?.status.removeListener(_onStatus);
    _subscription?.cancel();
  }
}
