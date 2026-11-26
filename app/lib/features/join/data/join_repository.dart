import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:flutter/foundation.dart';

@immutable
class InvitePreview {
  const InvitePreview({
    required this.groupName,
    required this.memberCount,
    required this.approveNew,
  });

  final String groupName;
  final int memberCount;
  final bool approveNew;
}

@immutable
class JoinedMember {
  const JoinedMember({
    required this.id,
    required this.groupId,
    required this.displayName,
    required this.status,
  });

  factory JoinedMember.fromJson(Map<String, dynamic> json) => JoinedMember(
    id: json['id'] as String,
    groupId: json['groupId'] as String,
    displayName: json['displayName'] as String,
    status: json['status'] as String,
  );

  final String id;
  final String groupId;
  final String displayName;

  /// `active` or `pending`.
  final String status;
}

/// Joining a group by its link and coming back with name + PIN.
abstract interface class JoinRepository {
  Future<InvitePreview> preview(String token);

  /// Signs the device in as the new member.
  Future<JoinedMember> join(String token, String displayName);

  /// Signs the device in as an existing member.
  Future<JoinedMember> returning(String token, String displayName, String pin);

  Future<void> setPin(String pin);

  /// `pending`, `active` or `removed` for the signed-in member.
  Future<String> myStatus();
}

class ApiJoinRepository implements JoinRepository {
  ApiJoinRepository(this._api, this._sessions);

  final ApiClient _api;
  final SessionStore _sessions;

  @override
  Future<InvitePreview> preview(String token) async {
    final json =
        await _api.get('/join/${Uri.encodeComponent(token)}')
            as Map<String, dynamic>;
    return InvitePreview(
      groupName: json['groupName'] as String,
      memberCount: json['memberCount'] as int,
      approveNew: json['approveNew'] as bool,
    );
  }

  @override
  Future<JoinedMember> join(String token, String displayName) =>
      _signIn('/join', {'token': token, 'displayName': displayName});

  @override
  Future<JoinedMember> returning(
    String token,
    String displayName,
    String pin,
  ) => _signIn('/join/returning', {
    'token': token,
    'displayName': displayName,
    'pin': pin,
  });

  @override
  Future<void> setPin(String pin) => _api.put('/me/pin', body: {'pin': pin});

  @override
  Future<String> myStatus() async =>
      ((await _api.get('/me')) as Map<String, dynamic>)['status'] as String;

  Future<JoinedMember> _signIn(String path, Map<String, String> body) async {
    final json = await _api.post(path, body: body) as Map<String, dynamic>;
    final member = JoinedMember.fromJson(
      json['member'] as Map<String, dynamic>,
    );
    await _sessions.write(
      StoredSession(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresAt: json['expiresAt'] as int,
        kind: 'member',
        groupId: member.groupId,
      ),
    );
    return member;
  }
}
