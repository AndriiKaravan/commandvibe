import 'dart:async';
import 'dart:convert';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:http/http.dart' as http;

/// JSON client of the CommandVibe server.
///
/// Adds the access token and the realtime session id; on `401` refreshes the
/// session once — parallel requests share that refresh — and repeats the call.
class ApiClient {
  ApiClient({
    required this.baseUri,
    required SessionStore sessionStore,
    http.Client? client,
    String? Function()? realtimeSessionId,
  }) : _sessions = sessionStore,
       _client = client ?? http.Client(),
       _realtimeSessionId = realtimeSessionId ?? (() => null);

  static const realtimeHeader = 'x-realtime-session';

  final Uri baseUri;
  final SessionStore _sessions;
  final http.Client _client;
  final String? Function() _realtimeSessionId;
  Future<StoredSession?>? _refreshing;

  /// Access token for the realtime socket; [forceRefresh] after the server refused the last one.
  Future<String?> accessToken({bool forceRefresh = false}) async {
    final session = await _sessions.read();
    if (session == null || !forceRefresh) {
      return session?.accessToken;
    }
    return (await _renewAfter(session))?.accessToken;
  }

  Future<Object?> get(String path) => _send('GET', path);

  Future<Object?> post(String path, {Object? body}) =>
      _send('POST', path, body: body);

  Future<Object?> put(String path, {Object? body}) =>
      _send('PUT', path, body: body);

  Future<Object?> patch(String path, {Object? body}) =>
      _send('PATCH', path, body: body);

  Future<Object?> delete(String path) => _send('DELETE', path);

  Future<Object?> _send(String method, String path, {Object? body}) async {
    final session = await _sessions.read();
    var response = await _request(method, path, body, session);
    if (session != null && _isTokenFailure(response)) {
      final renewed = await _renewAfter(session);
      if (renewed == null) {
        throw ApiException(401, code: 'session_expired');
      }
      response = await _request(method, path, body, renewed);
    }
    return _decode(response);
  }

  // Only the server's `token_invalid` means "refresh"; other 401s (a wrong PIN) are answers.
  static bool _isTokenFailure(http.Response response) {
    if (response.statusCode != 401) {
      return false;
    }
    final body = _tryJson(response.body);
    return body is Map && body['code'] == 'token_invalid';
  }

  /// Fresh tokens after [used] was refused: someone else (another request or tab) may have
  /// rotated them already, and refreshing the old token again would count as reuse.
  Future<StoredSession?> _renewAfter(StoredSession used) async {
    final stored = await _sessions.read();
    if (stored == null) {
      return null;
    }
    if (stored.refreshToken != used.refreshToken) {
      return stored;
    }
    return _refreshShared(stored);
  }

  Future<http.Response> _request(
    String method,
    String path,
    Object? body,
    StoredSession? session,
  ) async {
    final request = http.Request(method, baseUri.resolve(path))
      ..headers['accept'] = 'application/json';
    if (session != null) {
      request.headers['authorization'] = 'Bearer ${session.accessToken}';
    }
    final realtime = _realtimeSessionId();
    if (realtime != null && realtime.isNotEmpty) {
      request.headers[realtimeHeader] = realtime;
    }
    if (body != null) {
      request
        ..headers['content-type'] = 'application/json'
        ..body = jsonEncode(body);
    }
    try {
      return await http.Response.fromStream(await _client.send(request));
    } on http.ClientException catch (error) {
      throw NetworkException(error);
    }
  }

  Future<StoredSession?> _refreshShared(StoredSession stale) =>
      _refreshing ??= _refresh(stale).whenComplete(() => _refreshing = null);

  Future<StoredSession?> _refresh(StoredSession stale) async {
    final response = await _request('POST', '/auth/refresh', {
      'refreshToken': stale.refreshToken,
    }, null);
    if (response.statusCode >= 300) {
      // A rejected refresh token means the session is gone for good (revoked or reused).
      if (response.statusCode == 401 || response.statusCode == 400) {
        await _sessions.clear();
      }
      return null;
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    final renewed = stale.withTokens(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresAt: json['expiresAt'] as int,
    );
    await _sessions.write(renewed);
    return renewed;
  }

  Object? _decode(http.Response response) {
    final decoded = response.body.isEmpty ? null : _tryJson(response.body);
    if (response.statusCode >= 300) {
      final map = decoded is Map<String, dynamic>
          ? decoded
          : const <String, dynamic>{};
      final code = map['code'] ?? map['message'];
      throw ApiException(
        response.statusCode,
        code: code is String ? code : null,
        details: map,
      );
    }
    return decoded;
  }

  static Object? _tryJson(String body) {
    try {
      return jsonDecode(body);
    } on FormatException {
      return null;
    }
  }
}
