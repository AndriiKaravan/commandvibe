import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/organizer_auth/data/organizer_auth_repository.dart';
import 'package:commandvibe/features/organizer_auth/ui/organizer_login_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeOrganizerAuth implements OrganizerAuthRepository {
  Object? error;
  bool redirectPending = false;
  int signIns = 0;

  @override
  Future<bool> signInWithGoogle() async {
    signIns++;
    if (error != null) throw error!;
    return true;
  }

  @override
  Future<bool> completeRedirect() async => redirectPending;
}

void main() {
  group('OrganizerLoginViewModel', () {
    late FakeOrganizerAuth repository;
    late OrganizerLoginViewModel viewModel;

    setUp(() {
      repository = FakeOrganizerAuth();
      viewModel = OrganizerLoginViewModel(repository);
    });

    test('should be signed in after Google', () async {
      await viewModel.signIn();
      expect(viewModel.status, OrganizerLoginStatus.signedIn);
    });

    test('should finish a redirect that came back', () async {
      repository.redirectPending = true;
      await viewModel.resume();
      expect(viewModel.status, OrganizerLoginStatus.signedIn);
      expect(repository.signIns, 0);
    });

    test('should show a failure and allow another try', () async {
      repository.error = ApiException(403, code: 'provider_not_allowed');
      await viewModel.signIn();
      expect(viewModel.status, OrganizerLoginStatus.failed);
      repository.error = null;
      await viewModel.signIn();
      expect(viewModel.status, OrganizerLoginStatus.signedIn);
    });

    test('should stay idle when the person closed the Google window', () async {
      repository.error = const SignInCancelled();
      await viewModel.signIn();
      expect(viewModel.status, OrganizerLoginStatus.idle);
    });
  });
}
