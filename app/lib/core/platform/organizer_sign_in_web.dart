import 'package:commandvibe/core/platform/organizer_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart';

// Popups fail in many in-app browsers; these codes mean "use a redirect instead".
const _redirectCodes = {
  'popup-blocked',
  'operation-not-supported-in-this-environment',
  'web-storage-unsupported',
};

class WebOrganizerSignIn implements OrganizerSignIn {
  WebOrganizerSignIn([FirebaseAuth? auth])
    : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  @override
  Future<String?> google() async {
    final provider = GoogleAuthProvider()
      ..setCustomParameters({'prompt': 'select_account'});
    try {
      final result = await _auth.signInWithPopup(provider);
      return result.user?.getIdToken();
    } on FirebaseAuthException catch (error) {
      if (error.code == 'popup-closed-by-user' ||
          error.code == 'cancelled-popup-request') {
        throw const SignInCancelled();
      }
      if (_redirectCodes.contains(error.code)) {
        await _auth.signInWithRedirect(provider);
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<String?> completeRedirect() async {
    final result = await _auth.getRedirectResult();
    return result.user?.getIdToken();
  }

  @override
  Future<void> signOut() => _auth.signOut();
}

OrganizerSignIn createPlatformOrganizerSignIn() => WebOrganizerSignIn();
