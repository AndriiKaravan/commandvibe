import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:flutter/foundation.dart';

enum PinSetupStatus { idle, saving, saved, invalid, failed }

final _pinPattern = RegExp(r'^\d{4}$');

class PinSetupViewModel extends ChangeNotifier {
  PinSetupViewModel(this._repository);

  final JoinRepository _repository;
  PinSetupStatus _status = PinSetupStatus.idle;

  PinSetupStatus get status => _status;

  Future<void> save(String pin) async {
    if (!_pinPattern.hasMatch(pin)) {
      _set(PinSetupStatus.invalid);
      return;
    }
    _set(PinSetupStatus.saving);
    try {
      await _repository.setPin(pin);
      _set(PinSetupStatus.saved);
    } on Exception {
      _set(PinSetupStatus.failed);
    }
  }

  void _set(PinSetupStatus status) {
    _status = status;
    notifyListeners();
  }
}
