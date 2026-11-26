import 'dart:convert';

import 'package:commandvibe/core/platform/session_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _key = 'cv_session';

/// Browser local storage; the refresh token rotates on every use, so a copied one dies quickly.
class PreferencesSessionStore implements SessionStore {
  @override
  Future<StoredSession?> read() async {
    final raw = (await SharedPreferences.getInstance()).getString(_key);
    return raw == null
        ? null
        : StoredSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  @override
  Future<void> write(StoredSession session) async =>
      (await SharedPreferences.getInstance()).setString(
        _key,
        jsonEncode(session.toJson()),
      );

  @override
  Future<void> clear() async =>
      (await SharedPreferences.getInstance()).remove(_key);
}

SessionStore createPlatformSessionStore() => PreferencesSessionStore();
