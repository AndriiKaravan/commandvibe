import 'package:commandvibe/core/platform/session_store.dart';
import 'package:flutter/foundation.dart';

/// A [SessionStore] that tells listeners (the router) whenever the session changes or is lost.
class ObservedSessionStore extends ChangeNotifier implements SessionStore {
  ObservedSessionStore(this._inner);

  final SessionStore _inner;

  @override
  Future<StoredSession?> read() => _inner.read();

  @override
  Future<void> write(StoredSession session) async {
    await _inner.write(session);
    notifyListeners();
  }

  @override
  Future<void> clear() async {
    await _inner.clear();
    notifyListeners();
  }
}
