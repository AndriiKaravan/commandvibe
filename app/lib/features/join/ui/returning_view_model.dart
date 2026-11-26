import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:flutter/foundation.dart';

enum ReturningStatus {
  idle,
  submitting,
  signedIn,
  wrongPin,
  locked,
  noSuchLogin,
  invalidPin,
  closed,
  networkError,
  error,
}

final _pinPattern = RegExp(r'^\d{4}$');

/// "I'm already playing": name + PIN on another device.
class ReturningViewModel extends ChangeNotifier {
  ReturningViewModel(this._repository, {required this.token});

  final JoinRepository _repository;
  final String token;

  ReturningStatus _status = ReturningStatus.idle;
  int _attemptsLeft = 0;
  int _lockedMinutes = 0;
  JoinedMember? _member;

  ReturningStatus get status => _status;
  int get attemptsLeft => _attemptsLeft;
  int get lockedMinutes => _lockedMinutes;
  JoinedMember? get member => _member;

  Future<void> submit(String name, String pin) async {
    if (!_pinPattern.hasMatch(pin)) {
      _set(ReturningStatus.invalidPin);
      return;
    }
    _set(ReturningStatus.submitting);
    try {
      _member = await _repository.returning(token, name.trim(), pin);
      _set(ReturningStatus.signedIn);
    } on ApiException catch (error) {
      switch (error) {
        case ApiException(statusCode: 429):
          _lockedMinutes =
              ((error.details['retryAfterSeconds'] as num? ?? 900) / 60).ceil();
          _set(ReturningStatus.locked);
        case ApiException(code: 'wrong_pin'):
          _attemptsLeft = error.details['attemptsLeft'] as int? ?? 0;
          _set(ReturningStatus.wrongPin);
        case ApiException(statusCode: 401):
          _set(ReturningStatus.noSuchLogin);
        case ApiException(statusCode: 410):
          _set(ReturningStatus.closed);
        default:
          _set(ReturningStatus.error);
      }
    } on NetworkException {
      _set(ReturningStatus.networkError);
    }
  }

  void _set(ReturningStatus status) {
    _status = status;
    notifyListeners();
  }
}
