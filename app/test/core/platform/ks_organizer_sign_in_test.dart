import 'package:commandvibe/core/platform/ks_organizer_sign_in.dart';
import 'package:commandvibe/core/platform/organizer_sign_in.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/auth.dart';
import 'package:ks_core/testing.dart';

const _olena = AuthUser(
  uid: 'u1',
  isAnonymous: false,
  methods: {AuthMethod.google},
);

void main() {
  group('KsOrganizerSignIn', () {
    late FakeAuthService auth;
    late KsOrganizerSignIn signIn;

    setUp(() {
      auth = FakeAuthService();
      signIn = KsOrganizerSignIn(auth);
    });

    test(
      'should hand the Firebase ID token to the server after Google sign-in',
      () async {
        auth.googleResult = const AuthSignedIn(user: _olena);
        auth.token = 'id-token-1';

        expect(await signIn.google(), 'id-token-1');
      },
    );

    test('should report a closed Google sheet as a cancellation', () async {
      auth.googleResult = const AuthCancelled();

      await expectLater(signIn.google(), throwsA(isA<SignInCancelled>()));
    });

    test('should return null while the page leaves for a redirect', () async {
      auth.googleResult = const AuthRedirecting();

      expect(await signIn.google(), isNull);
    });

    test('should surface the failure reason', () async {
      auth.googleResult = const AuthFailed(AuthFailure.misconfigured);

      await expectLater(
        signIn.google(),
        throwsA(
          isA<OrganizerSignInFailed>().having(
            (error) => error.reason,
            'reason',
            AuthFailure.misconfigured,
          ),
        ),
      );
    });

    test('should have no redirect result when none is pending', () async {
      expect(await signIn.completeRedirect(), isNull);
    });

    test('should finish a redirect sign-in with the ID token', () async {
      auth.pendingResult = const AuthSignedIn(user: _olena);
      auth.token = 'id-token-2';

      expect(await signIn.completeRedirect(), 'id-token-2');
    });

    test('should surface a failed redirect sign-in', () async {
      auth.pendingResult = const AuthFailed(AuthFailure.network);

      await expectLater(
        signIn.completeRedirect(),
        throwsA(isA<OrganizerSignInFailed>()),
      );
    });

    test('should sign out of the provider', () async {
      await signIn.signOut();

      expect(auth.calls, contains('signOut'));
    });
  });
}
