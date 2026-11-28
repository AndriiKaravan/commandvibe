import 'package:flutter/foundation.dart';

/// Picks an avatar and saves it; a failed save leaves the old choice in place.
class AvatarPickerViewModel extends ChangeNotifier {
  AvatarPickerViewModel({
    required String? current,
    required Future<void> Function(String? id) save,
  }) : _current = current,
       _save = save;

  final Future<void> Function(String? id) _save;
  String? _current;
  bool _busy = false;
  bool _failed = false;

  String? get current => _current;
  bool get isBusy => _busy;
  bool get failed => _failed;

  Future<void> pick(String? id) async {
    if (_busy) {
      return;
    }
    _busy = true;
    _failed = false;
    notifyListeners();
    try {
      await _save(id);
      _current = id;
    } on Exception {
      _failed = true;
    }
    _busy = false;
    notifyListeners();
  }
}
