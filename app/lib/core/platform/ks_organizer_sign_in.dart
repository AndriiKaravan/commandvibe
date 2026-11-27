import 'package:commandvibe/core/platform/organizer_sign_in.dart';
import 'package:ks_core/auth.dart';

/// Non-secret OAuth client IDs of the `commandvibe-ks` Firebase project.
const _webClientId =
    '889388170734-q7a7frsasgebjv3qrmnqkl38a6bql9k5.apps.googleusercontent.com';
const _iosClientId =
    '889388170734-4e7m98p3g6sibdprsb14hfi35rrnedq8.apps.googleusercontent.com';

/// The organizer's Google sign-in on top of the shared `auth` module.
class KsOrganizerSignIn implements OrganizerSignIn {
  KsOrganizerSignIn(this._auth);

  final AuthService _auth;

  @override
  Future<String?> google() async => _tokenOf(await _auth.signInWithGoogle());

  @override
  Future<String?> completeRedirect() async {
    final result = await _auth.completePendingSignIn();
    return result == null ? null : _tokenOf(result);
  }

  @override
  Future<void> signOut() => _auth.signOut();

  Future<String?> _tokenOf(AuthResult result) async => switch (result) {
    AuthSignedIn() => await _auth.idToken(forceRefresh: true),
    AuthCancelled() => throw const SignInCancelled(),
    AuthRedirecting() => null,
    AuthFailed(:final reason, :final code) => throw OrganizerSignInFailed(
      reason,
      code,
    ),
  };
}

OrganizerSignIn createKsOrganizerSignIn() => KsOrganizerSignIn(
  FirebaseAuthService(
    google: const GoogleOptions(
      clientId: _iosClientId,
      serverClientId: _webClientId,
    ),
  ),
);
