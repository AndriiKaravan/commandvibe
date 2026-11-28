import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// Event types that change who has done what; the group's live views reload on them.
const submissionEvents = {
  'submission.created',
  'submission.replaced',
  'submission.hidden',
  'submission.restored',
  'photos.revealed',
};

/// Likes change points and what a photo list shows, but not who did what.
const likeEvents = {'like.changed'};

const commentEvents = {'comment.created', 'comment.deleted'};

/// Everything that can change what a list of photos shows.
const photoListEvents = {...submissionEvents, ...likeEvents, ...commentEvents};

/// A new entry in the bell list, or one read (here or on another device).
const notificationEvents = {'notification.created', 'notification.read'};

/// Event types that change who is in the game.
const membershipEvents = {'member.joined', 'member.approved', 'member.removed'};

/// A value read through the API and kept fresh over a realtime topic.
///
/// A failed reload keeps the last good value; a burst of events costs one extra load, not one each.
class LiveLoader<T> extends ChangeNotifier {
  LiveLoader(
    this._realtime, {
    required this.topic,
    required this.reloadOn,
    required Future<T> Function() load,
  }) : _load = load;

  final RealtimeClient _realtime;
  final String topic;
  final Set<String> reloadOn;
  final Future<T> Function() _load;

  final List<StreamSubscription<void>> _listeners = [];
  RealtimeSubscription? _subscription;
  T? _value;
  bool _loadFailed = false;
  bool _revoked = false;
  bool _running = false;
  bool _again = false;
  bool _disposed = false;

  T? get value => _value;
  bool get isLoaded => _value != null;
  bool get loadFailed => _loadFailed;

  /// True while the server refuses this member's reads (401/403/404): they no longer belong.
  bool get revoked => _revoked;

  /// The first resync after subscribing loads; later ones cover what was missed offline.
  void start() {
    final subscription = _subscription = _realtime.subscribe(topic);
    _listeners
      ..add(subscription.resyncs.listen((_) => reload()))
      ..add(
        subscription.events
            .where((event) => reloadOn.contains(event.type))
            .listen((_) => reload()),
      );
  }

  Future<void> reload() async {
    if (_running) {
      _again = true;
      return;
    }
    _running = true;
    try {
      do {
        _again = false;
        await _loadOnce();
      } while (_again && !_disposed);
    } finally {
      _running = false;
    }
  }

  Future<void> _loadOnce() async {
    try {
      final loaded = await _load();
      if (_disposed) {
        return;
      }
      _value = loaded;
      _loadFailed = false;
      _revoked = false;
    } on ApiException catch (error) {
      _loadFailed = true;
      _revoked = const {401, 403, 404}.contains(error.statusCode);
    } on NetworkException {
      _loadFailed = true;
    } on FormatException {
      _loadFailed = true;
    } on TypeError {
      _loadFailed = true;
    }
    if (!_disposed) {
      notifyListeners();
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
