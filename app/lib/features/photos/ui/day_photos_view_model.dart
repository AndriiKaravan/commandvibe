import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/data/photos_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// The photos of one day, kept live over the group topic.
class DayPhotosViewModel extends ChangeNotifier {
  DayPhotosViewModel(
    this._repository,
    this._realtime, {
    required this.groupId,
    required this.dayIndex,
    DateTime Function()? clock,
    this.linkRefreshGap = const Duration(seconds: 30),
  }) : _clock = clock ?? DateTime.now;

  static const _photoEvents = {
    'submission.created',
    'submission.replaced',
    'submission.hidden',
    'submission.restored',
    'photos.revealed',
  };

  final PhotosRepository _repository;
  final RealtimeClient _realtime;
  final String groupId;
  final int dayIndex;
  final DateTime Function() _clock;

  /// Links live only minutes; a failing image asks for new ones, but not more often than this.
  final Duration linkRefreshGap;

  final List<StreamSubscription<void>> _listeners = [];
  RealtimeSubscription? _subscription;
  DaySubmissions? _day;
  bool _loadFailed = false;
  DateTime? _lastLoad;
  bool _disposed = false;

  DaySubmissions? get day => _day;
  bool get loadFailed => _loadFailed;

  void start() {
    final subscription = _subscription = _realtime.subscribe('group:$groupId');
    // The first resync loads the day; later ones cover whatever was missed while offline.
    _listeners
      ..add(subscription.resyncs.listen((_) => load()))
      ..add(
        subscription.events
            .where((event) => _photoEvents.contains(event.type))
            .listen((_) => load()),
      );
  }

  /// An image would not load: its link has probably expired, so ask for fresh links.
  void imageFailed() {
    final last = _lastLoad;
    if (last != null && _clock().difference(last) < linkRefreshGap) {
      return;
    }
    unawaited(load());
  }

  Future<void> load() async {
    _lastLoad = _clock();
    try {
      final day = await _repository.day(groupId, dayIndex);
      if (_disposed) {
        return;
      }
      _day = day;
      _loadFailed = false;
    } on ApiException {
      _loadFailed = true;
    } on NetworkException {
      _loadFailed = true;
    }
    if (!_disposed) {
      notifyListeners();
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
