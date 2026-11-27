import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:flutter/foundation.dart';

/// Issues a fresh invite link on request; the old link stops working, so it never happens by itself.
class InviteViewModel extends ChangeNotifier {
  InviteViewModel(this._repository, {required this.groupId});

  final GroupsRepository _repository;
  final String groupId;

  bool _busy = false;
  bool _failed = false;
  String? _inviteUrl;
  bool _disposed = false;

  bool get isBusy => _busy;
  bool get failed => _failed;
  String? get inviteUrl => _inviteUrl;

  Future<void> rotate() async {
    if (_busy) {
      return;
    }
    _busy = true;
    _failed = false;
    notifyListeners();
    try {
      _inviteUrl = await _repository.rotateInvite(groupId);
    } on Exception {
      _failed = true;
    } on TypeError {
      _failed = true;
    }
    _busy = false;
    if (!_disposed) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
