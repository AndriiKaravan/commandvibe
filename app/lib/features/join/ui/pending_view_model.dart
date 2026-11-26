import 'dart:async';

import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// "Waiting for the organizer": listens on the member's own topic until approved.
class PendingViewModel extends ChangeNotifier {
  PendingViewModel(this._repository, this._realtime, {required this.memberId});

  final JoinRepository _repository;
  final RealtimeClient _realtime;
  final String memberId;

  RealtimeSubscription? _subscription;
  final List<StreamSubscription<void>> _listeners = [];
  bool _approved = false;
  bool _disposed = false;

  bool get approved => _approved;

  void start() {
    final subscription = _subscription = _realtime.subscribe(
      'member:$memberId',
    );
    // The status is read on resync too, so an approval made while offline is not missed.
    _listeners
      ..add(subscription.resyncs.listen((_) => _check()))
      ..add(subscription.events.listen((_) => _check()));
  }

  Future<void> _check() async {
    try {
      final status = await _repository.myStatus();
      if (!_disposed && status == 'active' && !_approved) {
        _approved = true;
        notifyListeners();
      }
    } on Exception {
      // Still waiting; the next event or reconnect checks again.
    }
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
