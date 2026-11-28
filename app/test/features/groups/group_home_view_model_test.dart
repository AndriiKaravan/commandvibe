import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/group_home_view_model.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

class CountingGroupsRepository implements GroupsRepository {
  int memberLoads = 0;
  List<GroupMember> current = const [
    GroupMember(
      id: 'm1',
      displayName: 'Olena',
      status: 'active',
      isOrganizer: false,
    ),
  ];

  @override
  Future<String> rotateInvite(String groupId) => throw UnimplementedError();

  @override
  Future<void> setAvatar(String groupId, String? avatar) =>
      throw UnimplementedError();

  @override
  Future<List<OwnedGroup>> owned() => throw UnimplementedError();

  @override
  Future<GroupSummary> group(String groupId) async =>
      const GroupSummary(id: 'g1', name: 'Office', ownerUid: 'org');

  @override
  Future<List<GroupMember>> members(String groupId) async {
    memberLoads++;
    return current;
  }

  @override
  Future<void> remove(String groupId, String memberId) async {}

  @override
  Future<void> approve(String groupId, String memberId) async {}

  @override
  Future<CreatedGroup> create(CreateGroupRequest request) =>
      throw UnimplementedError();
}

class RefusingGroupsRepository extends CountingGroupsRepository {
  RefusingGroupsRepository(this.error);

  final Exception error;

  @override
  Future<GroupSummary> group(String groupId) async => throw error;

  @override
  Future<List<GroupMember>> members(String groupId) async => throw error;
}

/// A subscription the test can deny, which ks_core's fake does not expose.
class DeniableSubscription implements RealtimeSubscription {
  DeniableSubscription(this.topic);

  @override
  final String topic;
  final _status = ValueNotifier(RealtimeSubscriptionStatus.active);
  String? _reason;

  void deny(String reason) {
    _reason = reason;
    _status.value = RealtimeSubscriptionStatus.denied;
  }

  @override
  Stream<RealtimeEvent> get events => const Stream.empty();

  @override
  Stream<void> get resyncs => const Stream.empty();

  @override
  ValueListenable<RealtimeSubscriptionStatus> get status => _status;

  @override
  String? get deniedReason => _reason;

  @override
  void cancel() {}
}

class DeniableRealtime extends FakeRealtimeClient {
  final subscriptions = <String, DeniableSubscription>{};

  @override
  RealtimeSubscription subscribe(String topic) =>
      subscriptions[topic] = DeniableSubscription(topic);
}

RealtimeEvent _event(String type) => RealtimeEvent(
  topic: 'group:g1',
  type: type,
  data: const {'memberId': 'm2'},
  id: 'e-$type',
  serverTime: DateTime.utc(2026, 12),
);

void main() {
  group('GroupHomeViewModel', () {
    late CountingGroupsRepository repository;
    late FakeRealtimeClient realtime;
    late GroupHomeViewModel viewModel;

    setUp(() {
      repository = CountingGroupsRepository();
      realtime = FakeRealtimeClient();
      viewModel = GroupHomeViewModel(
        repository,
        realtime,
        groupId: 'g1',
        isOwner: false,
      );
    });

    tearDown(() => viewModel.dispose());

    test(
      'should read members when the server confirms the group topic',
      () async {
        viewModel.start();
        await pumpEventQueue();
        expect(repository.memberLoads, 1);
        expect(viewModel.members.map((m) => m.displayName), ['Olena']);
        expect(viewModel.groupName, 'Office');
      },
    );

    test('should read again after a reconnect', () async {
      viewModel.start();
      await pumpEventQueue();
      realtime.emitTopicResync('group:g1');
      await pumpEventQueue();
      expect(repository.memberLoads, 2);
    });

    test('should reload members when member.joined arrives', () async {
      viewModel.start();
      await pumpEventQueue();
      repository.current = [
        ...repository.current,
        const GroupMember(
          id: 'm2',
          displayName: 'Taras',
          status: 'active',
          isOrganizer: false,
        ),
      ];
      realtime.emit(_event('member.joined'));
      await pumpEventQueue();
      expect(viewModel.members.map((m) => m.displayName), ['Olena', 'Taras']);
    });

    test('should also follow the owner topic for the organizer', () {
      final owner = GroupHomeViewModel(
        repository,
        realtime,
        groupId: 'g1',
        isOwner: true,
      )..start();
      expect(realtime.subscribedTopics, containsAll(['group:g1', 'org:g1']));
      owner.dispose();
    });

    test(
      'should report lost access instead of an empty page when the server refuses',
      () async {
        final refusing = RefusingGroupsRepository(ApiException(403));
        final member = GroupHomeViewModel(
          refusing,
          realtime,
          groupId: 'g1',
          isOwner: false,
        )..start();
        await pumpEventQueue();
        expect(member.revoked, isTrue);
        member.dispose();
      },
    );

    test(
      'should show an error, not crash, when loading fails otherwise',
      () async {
        final failing = RefusingGroupsRepository(NetworkException('offline'));
        final member = GroupHomeViewModel(
          failing,
          realtime,
          groupId: 'g1',
          isOwner: false,
        )..start();
        await pumpEventQueue();
        expect(member.revoked, isFalse);
        expect(member.loadFailed, isTrue);
        member.dispose();
      },
    );

    test('should leave the group screen when access is revoked', () async {
      final deniable = DeniableRealtime();
      final member = GroupHomeViewModel(
        repository,
        deniable,
        groupId: 'g1',
        isOwner: false,
      )..start();
      deniable.subscriptions['group:g1']!.deny('revoked');
      expect(member.revoked, isTrue);
      member.dispose();
    });
  });
}
