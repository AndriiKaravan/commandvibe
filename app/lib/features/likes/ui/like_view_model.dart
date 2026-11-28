import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:flutter/foundation.dart';

/// The like under one photo: shows the tap at once, sends it, and rolls back if the server refuses.
class LikeViewModel extends ChangeNotifier {
  LikeViewModel({
    required LikeInfo initial,
    required Future<void> Function(bool liked) send,
  }) : _info = initial,
       _send = send;

  final Future<void> Function(bool liked) _send;
  LikeInfo _info;
  bool _busy = false;
  bool _failed = false;

  LikeInfo get info => _info;
  bool get busy => _busy;
  bool get failed => _failed;

  /// Fresh data from the server; ignored while a tap is on its way, so it cannot undo it.
  void sync(LikeInfo fresh) {
    if (_busy) {
      return;
    }
    _info = fresh;
    notifyListeners();
  }

  Future<void> toggle() async {
    if (_busy) {
      return;
    }
    final before = _info;
    final liked = !before.mine;
    _busy = true;
    _failed = false;
    _info = LikeInfo(
      count: liked
          ? before.count + 1
          : (before.count - 1).clamp(0, before.count),
      mine: liked,
      canLike: before.canLike,
      by: before.by,
    );
    notifyListeners();
    try {
      await _send(liked);
    } on Exception {
      _info = before;
      _failed = true;
    }
    _busy = false;
    notifyListeners();
  }
}
