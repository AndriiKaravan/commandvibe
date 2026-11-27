import 'package:commandvibe/core/api/api_client.dart';
import 'package:flutter/foundation.dart';

@immutable
class CreateGroupRequest {
  const CreateGroupRequest({
    required this.name,
    required this.timezone,
    required this.playsToo,
    required this.approveNew,
  });

  final String name;
  final String timezone;
  final bool playsToo;
  final bool approveNew;

  Map<String, Object> toJson() => {
    'name': name,
    'timezone': timezone,
    'playsToo': playsToo,
    'approveNew': approveNew,
  };

  @override
  bool operator ==(Object other) =>
      other is CreateGroupRequest &&
      other.name == name &&
      other.timezone == timezone &&
      other.playsToo == playsToo &&
      other.approveNew == approveNew;

  @override
  int get hashCode => Object.hash(name, timezone, playsToo, approveNew);

  @override
  String toString() =>
      'CreateGroupRequest($name, $timezone, playsToo: $playsToo, approveNew: $approveNew)';
}

@immutable
class CreatedGroup {
  const CreatedGroup({
    required this.groupId,
    required this.name,
    required this.inviteUrl,
  });

  final String groupId;
  final String name;
  final String inviteUrl;
}

@immutable
class GroupSummary {
  const GroupSummary({
    required this.id,
    required this.name,
    required this.ownerUid,
  });

  final String id;
  final String name;
  final String ownerUid;
}

/// One row of the organizer's group list.
@immutable
class OwnedGroup {
  const OwnedGroup({
    required this.id,
    required this.name,
    required this.status,
    required this.activeMembers,
  });

  factory OwnedGroup.fromJson(Map<String, dynamic> json) => OwnedGroup(
    id: json['id'] as String,
    name: json['name'] as String,
    status: json['status'] as String,
    activeMembers: json['activeMembers'] as int,
  );

  final String id;
  final String name;
  final String status;
  final int activeMembers;
}

@immutable
class GroupMember {
  const GroupMember({
    required this.id,
    required this.displayName,
    required this.status,
    required this.isOrganizer,
  });

  factory GroupMember.fromJson(Map<String, dynamic> json) => GroupMember(
    id: json['id'] as String,
    displayName: json['displayName'] as String,
    status: json['status'] as String,
    isOrganizer: json['isOrganizer'] as bool? ?? false,
  );

  final String id;
  final String displayName;
  final String status;
  final bool isOrganizer;

  bool get isPending => status == 'pending';
}

abstract interface class GroupsRepository {
  Future<CreatedGroup> create(CreateGroupRequest request);

  /// The groups the signed-in organizer owns, newest first.
  Future<List<OwnedGroup>> owned();

  /// Replaces the invite link; the old one stops working. Returns the new URL.
  Future<String> rotateInvite(String groupId);

  Future<GroupSummary> group(String groupId);

  Future<List<GroupMember>> members(String groupId);

  Future<void> approve(String groupId, String memberId);

  Future<void> remove(String groupId, String memberId);
}

class ApiGroupsRepository implements GroupsRepository {
  ApiGroupsRepository(this._api);

  final ApiClient _api;

  @override
  Future<CreatedGroup> create(CreateGroupRequest request) async {
    final json =
        await _api.post('/groups', body: request.toJson())
            as Map<String, dynamic>;
    final group = json['group'] as Map<String, dynamic>;
    return CreatedGroup(
      groupId: group['id'] as String,
      name: group['name'] as String,
      inviteUrl: json['inviteUrl'] as String,
    );
  }

  @override
  Future<List<OwnedGroup>> owned() async {
    final json = await _api.get('/groups') as Map<String, dynamic>;
    return (json['items'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(OwnedGroup.fromJson)
        .toList();
  }

  @override
  Future<String> rotateInvite(String groupId) async {
    final json =
        await _api.post('/groups/$groupId/invite/rotate')
            as Map<String, dynamic>;
    return json['inviteUrl'] as String;
  }

  @override
  Future<GroupSummary> group(String groupId) async {
    final json = await _api.get('/groups/$groupId') as Map<String, dynamic>;
    return GroupSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      ownerUid: json['ownerUid'] as String,
    );
  }

  @override
  Future<List<GroupMember>> members(String groupId) async {
    final list = await _api.get('/groups/$groupId/members') as List<dynamic>;
    return list.cast<Map<String, dynamic>>().map(GroupMember.fromJson).toList();
  }

  @override
  Future<void> approve(String groupId, String memberId) =>
      _api.post('/groups/$groupId/members/$memberId/approve');

  @override
  Future<void> remove(String groupId, String memberId) =>
      _api.post('/groups/$groupId/members/$memberId/remove');
}
