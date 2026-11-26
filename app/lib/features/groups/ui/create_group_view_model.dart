import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:flutter/foundation.dart';

enum CreateGroupError { invalidName, failed }

/// The organizer's new-group form (design 6: "I play too" on, approval off by default).
class CreateGroupViewModel extends ChangeNotifier {
  CreateGroupViewModel(
    this._repository, {
    required Future<String> Function() timezone,
  }) : _timezone = timezone;

  final GroupsRepository _repository;
  final Future<String> Function() _timezone;

  bool playsToo = true;
  bool approveNew = false;
  bool _busy = false;
  CreateGroupError? _error;
  CreatedGroup? _created;

  bool get isBusy => _busy;
  CreateGroupError? get error => _error;
  CreatedGroup? get created => _created;

  void setPlaysToo(bool value) {
    playsToo = value;
    notifyListeners();
  }

  void setApproveNew(bool value) {
    approveNew = value;
    notifyListeners();
  }

  Future<void> create(String rawName) async {
    final name = rawName.trim();
    if (name.isEmpty || name.length > 60) {
      _error = CreateGroupError.invalidName;
      notifyListeners();
      return;
    }
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      _created = await _repository.create(
        CreateGroupRequest(
          name: name,
          timezone: await _timezone(),
          playsToo: playsToo,
          approveNew: approveNew,
        ),
      );
    } on Exception {
      _error = CreateGroupError.failed;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
