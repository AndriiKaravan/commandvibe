import 'dart:async';

import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// The group's home for P1: who is in, live; the game screens replace it in P4.
class GroupHomeViewModel extends ChangeNotifier {
  GroupHomeViewModel(
    this._repository,
    this._realtime, {
    required this.groupId,
    required this.isOwner,
  });

  final GroupsRepository _repository;
  final RealtimeClient _realtime;
  final String groupId;
  final bool isOwner;

  final List<RealtimeSubscription> _subscriptions = [];
  final List<StreamSubscription<void>> _listeners = [];
  List<GroupMember> _members = const [];
  String _groupName = '';
  bool _revoked = false;
  bool _disposed = false;

  List<GroupMember> get members => _members;
  List<GroupMember> get active => _members.where((m) => !m.isPending).toList();
  List<GroupMember> get pending => _members.where((m) => m.isPending).toList();
  String get groupName => _groupName;

  /// True when the server took this member's access away; the view signs out.
  bool get revoked => _revoked;

  void start() {
    _follow('group:$groupId');
    if (isOwner) {
      _follow('org:$groupId');
    }
  }

  Future<void> approve(String memberId) async {
    await _repository.approve(groupId, memberId);
    await _reload();
  }

  Future<void> remove(String memberId) async {
    await _repository.remove(groupId, memberId);
    await _reload();
  }

  void _follow(String topic) {
    final subscription = _realtime.subscribe(topic);
    _subscriptions.add(subscription);
    // Data is read on resyncs, so nothing published while offline is missed.
    _listeners
      ..add(subscription.resyncs.listen((_) => _reload()))
      ..add(subscription.events.listen((_) => _reload()));
    subscription.status.addListener(() => _onStatus(subscription));
  }

  void _onStatus(RealtimeSubscription subscription) {
    if (subscription.status.value == RealtimeSubscriptionStatus.denied &&
        subscription.deniedReason == 'revoked') {
      _revoked = true;
      notifyListeners();
    }
  }

  Future<void> _reload() async {
    final results = await Future.wait([
      _repository.group(groupId),
      _repository.members(groupId),
    ]);
    if (_disposed) {
      return;
    }
    _groupName = (results[0] as GroupSummary).name;
    _members = results[1] as List<GroupMember>;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    for (final listener in _listeners) {
      listener.cancel();
    }
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    super.dispose();
  }
}
