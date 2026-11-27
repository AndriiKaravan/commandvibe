import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:flutter/foundation.dart';

enum MyGroupsStatus { loading, failed, loaded }

/// The organizer's groups, fetched once per visit of the screen.
class MyGroupsViewModel extends ChangeNotifier {
  MyGroupsViewModel(this._repository);

  final GroupsRepository _repository;

  MyGroupsStatus _status = MyGroupsStatus.loading;
  List<OwnedGroup> _groups = const [];
  bool _disposed = false;

  MyGroupsStatus get status => _status;
  List<OwnedGroup> get groups => _groups;

  /// Where to go without asking: nothing to pick means create, one group means open it.
  String? autoDestination({required bool showAll}) {
    if (_status != MyGroupsStatus.loaded) {
      return null;
    }
    if (_groups.isEmpty) {
      return '/org/new';
    }
    return _groups.length == 1 && !showAll ? '/g/${_groups.single.id}' : null;
  }

  Future<void> load() async {
    _status = MyGroupsStatus.loading;
    notifyListeners();
    try {
      _groups = await _repository.owned();
      _status = MyGroupsStatus.loaded;
    } on Exception {
      _status = MyGroupsStatus.failed;
    } on TypeError {
      _status = MyGroupsStatus.failed;
    }
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
