import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/features/feed/data/feed_models.dart';
import 'package:commandvibe/features/feed/data/feed_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// The group's photos newest first, paged by cursor and kept fresh over the group topic.
class FeedViewModel extends ChangeNotifier {
  FeedViewModel(
    this._repository,
    this._realtime, {
    required this.groupId,
    this.pageSize = 20,
  });

  static const _maxRefresh = 50;

  final FeedRepository _repository;
  final RealtimeClient _realtime;
  final String groupId;
  final int pageSize;

  final List<StreamSubscription<void>> _listeners = [];
  RealtimeSubscription? _subscription;
  List<FeedItem> _items = const [];
  String? _next;
  FeedFilter _filter = const FeedFilter();
  bool _loading = false;
  bool _loadFailed = false;
  bool _loaded = false;
  bool _disposed = false;

  /// Bumped whenever the list is started over, so older answers are dropped.
  int _generation = 0;

  List<FeedItem> get items => _items;
  FeedFilter get filter => _filter;
  bool get hasMore => _next != null;
  bool get isLoading => _loading;
  bool get isLoaded => _loaded;
  bool get loadFailed => _loadFailed;

  void start() {
    final subscription = _subscription = _realtime.subscribe('group:$groupId');
    final reloadOn = {...submissionEvents, ...membershipEvents};
    _listeners
      ..add(subscription.resyncs.listen((_) => refresh()))
      ..add(
        subscription.events
            .where((event) => reloadOn.contains(event.type))
            .listen((_) => refresh()),
      );
  }

  Future<void> setFilter(FeedFilter filter) async {
    _filter = filter;
    _generation++;
    _items = const [];
    _next = null;
    _loaded = false;
    notifyListeners();
    await _fetch(before: null, limit: pageSize, replace: true);
  }

  /// Re-reads what is already on screen, so new and changed photos show without losing the scroll extent.
  Future<void> refresh() => _fetch(
    before: null,
    limit: _items.length.clamp(pageSize, _maxRefresh),
    replace: true,
  );

  Future<void> loadMore() async {
    final cursor = _next;
    if (cursor == null || _loading) {
      return;
    }
    await _fetch(before: cursor, limit: pageSize, replace: false);
  }

  Future<void> _fetch({
    required String? before,
    required int limit,
    required bool replace,
  }) async {
    if (_loading && !replace) {
      return;
    }
    final generation = _generation;
    _loading = true;
    notifyListeners();
    try {
      final page = await _repository.page(
        groupId,
        filter: _filter,
        before: before,
        limit: limit,
      );
      if (_disposed || generation != _generation) {
        return;
      }
      _items = replace ? page.items : _merge(_items, page.items);
      _next = page.next;
      _loaded = true;
      _loadFailed = false;
    } on ApiException {
      _loadFailed = _isCurrent(generation) || _loadFailed;
    } on NetworkException {
      _loadFailed = _isCurrent(generation) || _loadFailed;
    } on FormatException {
      _loadFailed = _isCurrent(generation) || _loadFailed;
    } on TypeError {
      _loadFailed = _isCurrent(generation) || _loadFailed;
    }
    if (_isCurrent(generation)) {
      _loading = false;
    }
    if (!_disposed) {
      notifyListeners();
    }
  }

  bool _isCurrent(int generation) => !_disposed && generation == _generation;

  List<FeedItem> _merge(List<FeedItem> current, List<FeedItem> more) {
    final known = {for (final item in current) item.key};
    return [...current, ...more.where((item) => !known.contains(item.key))];
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
