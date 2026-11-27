import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/data/photos_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// The organizer's open complaints, live over the organizer topic.
class ComplaintsViewModel extends ChangeNotifier {
  ComplaintsViewModel(
    this._repository,
    this._realtime, {
    required this.groupId,
  });

  final PhotosRepository _repository;
  final RealtimeClient _realtime;
  final String groupId;

  final List<StreamSubscription<void>> _listeners = [];
  RealtimeSubscription? _subscription;
  List<ComplaintItem> _items = const [];
  bool _loaded = false;
  bool _loadFailed = false;
  bool _disposed = false;

  List<ComplaintItem> get items => _items;
  int get count => _items.length;
  bool get loaded => _loaded;
  bool get loadFailed => _loadFailed;

  void start() {
    final subscription = _subscription = _realtime.subscribe('org:$groupId');
    _listeners
      ..add(subscription.resyncs.listen((_) => load()))
      ..add(
        subscription.events
            .where((event) => event.type == 'complaint.created')
            .listen((_) => load()),
      );
  }

  Future<void> load() async {
    try {
      final items = await _repository.complaints(groupId);
      if (_disposed) {
        return;
      }
      _items = items;
      _loadFailed = false;
      _loaded = true;
    } on ApiException {
      _loadFailed = true;
    } on NetworkException {
      _loadFailed = true;
    }
    if (!_disposed) {
      notifyListeners();
    }
  }

  Future<void> hide(ComplaintItem item) => _act(
    () => _repository.setHidden(groupId, item.dayIndex, item.memberId, true),
  );

  Future<void> dismiss(ComplaintItem item) =>
      _act(() => _repository.dismiss(groupId, item.dayIndex, item.memberId));

  Future<void> _act(Future<void> Function() action) async {
    try {
      await action();
    } on ApiException {
      // Reloaded below: a refused action simply leaves the list as the server has it.
    } on NetworkException {
      // Same.
    }
    await load();
  }

  @override
  void dispose() {
    _disposed = true;
    for (final listener in _listeners) {
      listener.cancel();
    }
    _subscription?.cancel();
    super.dispose();
  }
}
