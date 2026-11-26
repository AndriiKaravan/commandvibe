import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:flutter/foundation.dart';

enum JoinStatus {
  loading,
  ready,
  submitting,
  joined,
  pending,
  nameTaken,
  invalidName,
  closed,
  full,
  networkError,
  error,
}

/// The invite screen: group preview, then the name.
class JoinViewModel extends ChangeNotifier {
  JoinViewModel(this._repository, {required this.token});

  final JoinRepository _repository;
  final String token;

  JoinStatus _status = JoinStatus.loading;
  InvitePreview? _preview;
  JoinedMember? _member;

  JoinStatus get status => _status;
  String get groupName => _preview?.groupName ?? '';
  int get memberCount => _preview?.memberCount ?? 0;
  JoinedMember? get member => _member;

  Future<void> load() async {
    _set(JoinStatus.loading);
    try {
      _preview = await _repository.preview(token);
      _set(JoinStatus.ready);
    } on Exception catch (error) {
      _set(_statusFor(error));
    }
  }

  Future<void> submit(String rawName) async {
    final name = rawName.trim();
    if (name.isEmpty || name.length > 40) {
      _set(JoinStatus.invalidName);
      return;
    }
    _set(JoinStatus.submitting);
    try {
      _member = await _repository.join(token, name);
      _set(
        _member!.status == 'pending' ? JoinStatus.pending : JoinStatus.joined,
      );
    } on Exception catch (error) {
      _set(_statusFor(error));
    }
  }

  JoinStatus _statusFor(Exception error) => switch (error) {
    ApiException(statusCode: 409) => JoinStatus.nameTaken,
    ApiException(statusCode: 410) => JoinStatus.closed,
    ApiException(statusCode: 422, code: 'group_full') => JoinStatus.full,
    ApiException(statusCode: 422) => JoinStatus.invalidName,
    NetworkException() => JoinStatus.networkError,
    _ => JoinStatus.error,
  };

  void _set(JoinStatus status) {
    _status = status;
    notifyListeners();
  }
}
