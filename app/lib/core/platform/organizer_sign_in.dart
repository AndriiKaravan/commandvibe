import 'package:commandvibe/core/platform/ks_organizer_sign_in.dart';
import 'package:ks_core/auth.dart' show AuthFailure;

/// The person closed the Google window; not an error worth showing.
class SignInCancelled implements Exception {
  const SignInCancelled();
}

/// Sign-in ended with a failure the module could name.
class OrganizerSignInFailed implements Exception {
  const OrganizerSignInFailed(this.reason, [this.code]);

  final AuthFailure reason;
  final String? code;

  @override
  String toString() => 'OrganizerSignInFailed(${reason.name}, $code)';
}

/// Google sign-in through Firebase Auth; yields a Firebase ID token for the server.
abstract interface class OrganizerSignIn {
  factory OrganizerSignIn.platform() => createKsOrganizerSignIn();

  /// ID token, or null when the page is leaving for a redirect sign-in.
  Future<String?> google();

  /// ID token of a redirect sign-in that just came back (web), else null.
  Future<String?> completeRedirect();

  Future<void> signOut();
}
