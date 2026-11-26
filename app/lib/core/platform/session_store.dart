import 'package:commandvibe/core/platform/session_store_io.dart'
    if (dart.library.js_interop) 'package:commandvibe/core/platform/session_store_web.dart';
import 'package:flutter/foundation.dart';

/// Tokens of the signed-in organizer or member.
@immutable
class StoredSession {
  const StoredSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.kind,
    this.groupId,
  });

  factory StoredSession.fromJson(Map<String, dynamic> json) => StoredSession(
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    expiresAt: json['expiresAt'] as int,
    kind: json['kind'] as String,
    groupId: json['groupId'] as String?,
  );

  final String accessToken;
  final String refreshToken;

  /// Unix seconds when [accessToken] expires.
  final int expiresAt;

  /// `organizer` or `member`.
  final String kind;
  final String? groupId;

  bool get isOrganizer => kind == 'organizer';

  StoredSession withTokens({
    required String accessToken,
    required String refreshToken,
    required int expiresAt,
  }) => StoredSession(
    accessToken: accessToken,
    refreshToken: refreshToken,
    expiresAt: expiresAt,
    kind: kind,
    groupId: groupId,
  );

  Map<String, Object?> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'expiresAt': expiresAt,
    'kind': kind,
    'groupId': groupId,
  };
}

/// Where the session lives between launches: secure storage in apps, local storage on the web.
abstract interface class SessionStore {
  factory SessionStore.platform() => createPlatformSessionStore();

  Future<StoredSession?> read();

  Future<void> write(StoredSession session);

  Future<void> clear();
}
