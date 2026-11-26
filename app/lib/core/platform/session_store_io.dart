import 'dart:convert';

import 'package:commandvibe/core/platform/session_store.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _key = 'cv_session';

/// Keychain on iOS, encrypted preferences on Android.
class SecureSessionStore implements SessionStore {
  SecureSessionStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<StoredSession?> read() async {
    final raw = await _storage.read(key: _key);
    return raw == null
        ? null
        : StoredSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  @override
  Future<void> write(StoredSession session) =>
      _storage.write(key: _key, value: jsonEncode(session.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

SessionStore createPlatformSessionStore() => SecureSessionStore();
