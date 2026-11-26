import 'package:commandvibe/core/platform/organizer_sign_in.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Android and iOS: Firebase opens Google in the system browser tab.
class NativeOrganizerSignIn implements OrganizerSignIn {
  NativeOrganizerSignIn([FirebaseAuth? auth])
    : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  @override
  Future<String?> google() async {
    try {
      final result = await _auth.signInWithProvider(GoogleAuthProvider());
      return result.user?.getIdToken();
    } on FirebaseAuthException catch (error) {
      if (error.code == 'web-context-cancelled' || error.code == 'canceled') {
        throw const SignInCancelled();
      }
      rethrow;
    }
  }

  @override
  Future<String?> completeRedirect() async => null;

  @override
  Future<void> signOut() => _auth.signOut();
}

OrganizerSignIn createPlatformOrganizerSignIn() => NativeOrganizerSignIn();
