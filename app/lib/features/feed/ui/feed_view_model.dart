import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/features/feed/data/feed_models.dart';
import 'package:commandvibe/features/feed/data/feed_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// The group's photos newest first, paged by cursor and kept fresh over the group topic.
///
/// Reads of the first page run one at a time and each starts a new generation, so a page load
/// that began earlier can never splice stale items onto a fresher list.
class FeedViewModel extends ChangeNotifier {
  FeedViewModel(
    this._repository,
    this._realtime, {
    required this.groupId,
    this.pageSize = 20,
    this.imageRefreshGap = const Duration(seconds: 30),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  static const _maxRefresh = 50;

  final FeedRepository _repository;
  final RealtimeClient _realtime;
  final String groupId;
  final int pageSize;

  /// Links live only minutes; a failing image asks for fresh ones, but not more often than this.
  final Duration imageRefreshGap;
  final DateTime Function() _clock;

  final List<StreamSubscription<void>> _listeners = [];
  RealtimeSubscription? _subscription;
  List<FeedItem> _items = const [];
  String? _next;
  FeedFilter _filter = const FeedFilter();
  bool _paging = false;
  bool _refreshing = false;
  bool _refreshAgain = false;
  bool _loadFailed = false;
  bool _loaded = false;
  bool _disposed = false;
  DateTime? _lastRead;

  /// Bumped whenever the first page is read again, so older answers are dropped.
  int _generation = 0;

  List<FeedItem> get items => _items;
  FeedFilter get filter => _filter;
  bool get hasMore => _next != null;
  bool get isLoading => _paging || _refreshing;
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

  Future<void> setFilter(FeedFilter filter) {
    _filter = filter;
    _generation++;
    _items = const [];
    _next = null;
    _loaded = false;
    notifyListeners();
    return refresh();
  }

  /// An image would not load: its link has probably expired, so read again, but not in a loop.
  void imageFailed() {
    final last = _lastRead;
    if (last != null && _clock().difference(last) < imageRefreshGap) {
      return;
    }
    unawaited(refresh());
  }

  /// Re-reads what is already on screen, so new and changed photos show without losing the scroll extent.
  Future<void> refresh() async {
    if (_refreshing) {
      _refreshAgain = true;
      return;
    }
    _refreshing = true;
    try {
      do {
        _refreshAgain = false;
        await _readFirst(++_generation);
      } while (_refreshAgain && !_disposed);
    } finally {
      _refreshing = false;
      if (!_disposed) {
        notifyListeners();
      }
    }
  }

  Future<void> loadMore() async {
    final cursor = _next;
    if (cursor == null || _paging || _refreshing) {
      return;
    }
    final generation = _generation;
    _paging = true;
    notifyListeners();
    try {
      final page = await _repository.page(
        groupId,
        filter: _filter,
        before: cursor,
        limit: pageSize,
      );
      if (_disposed || generation != _generation) {
        return;
      }
      final known = {for (final item in _items) item.key};
      _items = [
        ..._items,
        ...page.items.where((item) => !known.contains(item.key)),
      ];
      _next = page.next;
      _loadFailed = false;
    } on ApiException {
      _loadFailed = _loadFailed || generation == _generation;
    } on NetworkException {
      _loadFailed = _loadFailed || generation == _generation;
    } on FormatException {
      _loadFailed = _loadFailed || generation == _generation;
    } on TypeError {
      _loadFailed = _loadFailed || generation == _generation;
    } finally {
      _paging = false;
      if (!_disposed) {
        notifyListeners();
      }
    }
  }

  Future<void> _readFirst(int generation) async {
    _lastRead = _clock();
    try {
      final page = await _repository.page(
        groupId,
        filter: _filter,
        limit: _items.length.clamp(pageSize, _maxRefresh),
      );
      if (_disposed || generation != _generation) {
        return;
      }
      _items = page.items;
      _next = page.next;
      _loaded = true;
      _loadFailed = false;
    } on ApiException {
      _loadFailed = generation == _generation;
    } on NetworkException {
      _loadFailed = generation == _generation;
    } on FormatException {
      _loadFailed = generation == _generation;
    } on TypeError {
      _loadFailed = generation == _generation;
    }
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
