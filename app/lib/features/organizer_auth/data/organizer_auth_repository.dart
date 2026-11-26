import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/platform/organizer_sign_in.dart';
import 'package:commandvibe/core/platform/session_store.dart';

export 'package:commandvibe/core/platform/organizer_sign_in.dart'
    show SignInCancelled;

/// Organizer sign-in: Google through Firebase, then the server's own session.
abstract interface class OrganizerAuthRepository {
  /// True when signed in; false when the page is leaving for a redirect.
  Future<bool> signInWithGoogle();

  /// True when a redirect sign-in came back and is now complete.
  Future<bool> completeRedirect();
}

class ApiOrganizerAuthRepository implements OrganizerAuthRepository {
  ApiOrganizerAuthRepository(this._api, this._sessions, this._signIn);

  final ApiClient _api;
  final SessionStore _sessions;
  final OrganizerSignIn _signIn;

  @override
  Future<bool> signInWithGoogle() async {
    final idToken = await _signIn.google();
    return idToken != null && await _exchange(idToken);
  }

  @override
  Future<bool> completeRedirect() async {
    final idToken = await _signIn.completeRedirect();
    return idToken != null && await _exchange(idToken);
  }

  Future<bool> _exchange(String idToken) async {
    final json =
        await _api.post('/auth/organizer', body: {'idToken': idToken})
            as Map<String, dynamic>;
    await _sessions.write(
      StoredSession(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresAt: json['expiresAt'] as int,
        kind: 'organizer',
      ),
    );
    return true;
  }
}
