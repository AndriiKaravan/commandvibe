import 'package:commandvibe/core/platform/organizer_sign_in_io.dart'
    if (dart.library.js_interop) 'package:commandvibe/core/platform/organizer_sign_in_web.dart';

/// The person closed the Google window; not an error worth showing.
class SignInCancelled implements Exception {
  const SignInCancelled();
}

/// Google sign-in through Firebase Auth; yields a Firebase ID token for the server.
abstract interface class OrganizerSignIn {
  factory OrganizerSignIn.platform() => createPlatformOrganizerSignIn();

  /// ID token, or null when the page is leaving for a redirect sign-in.
  Future<String?> google();

  /// ID token of a redirect sign-in that just came back (web), else null.
  Future<String?> completeRedirect();

  Future<void> signOut();
}
