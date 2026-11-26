import 'dart:developer' as developer;

import 'package:commandvibe/features/organizer_auth/data/organizer_auth_repository.dart';
import 'package:flutter/foundation.dart';

enum OrganizerLoginStatus { idle, busy, redirecting, signedIn, failed }

class OrganizerLoginViewModel extends ChangeNotifier {
  OrganizerLoginViewModel(this._repository);

  final OrganizerAuthRepository _repository;
  OrganizerLoginStatus _status = OrganizerLoginStatus.idle;

  OrganizerLoginStatus get status => _status;

  /// Picks up a redirect sign-in after the page came back from Google.
  Future<void> resume() async {
    try {
      if (await _repository.completeRedirect()) {
        _set(OrganizerLoginStatus.signedIn);
      }
    } on Exception catch (error) {
      developer.log('redirect sign-in failed', name: 'auth', error: error);
      _set(OrganizerLoginStatus.failed);
    }
  }

  Future<void> signIn() async {
    _set(OrganizerLoginStatus.busy);
    try {
      final signedIn = await _repository.signInWithGoogle();
      _set(
        signedIn
            ? OrganizerLoginStatus.signedIn
            : OrganizerLoginStatus.redirecting,
      );
    } on SignInCancelled {
      _set(OrganizerLoginStatus.idle);
    } on Exception catch (error) {
      developer.log('sign-in failed', name: 'auth', error: error);
      _set(OrganizerLoginStatus.failed);
    }
  }

  void _set(OrganizerLoginStatus status) {
    _status = status;
    notifyListeners();
  }
}
