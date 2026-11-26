import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:commandvibe/features/join/ui/join_view_model.dart';
import 'package:commandvibe/features/join/ui/returning_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeJoinRepository implements JoinRepository {
  Object? previewError;
  Object? joinError;
  Object? returningError;
  String memberStatus = 'active';
  final List<String> joinedNames = [];

  @override
  Future<InvitePreview> preview(String token) async {
    if (previewError != null) throw previewError!;
    return const InvitePreview(
      groupName: 'Office',
      memberCount: 3,
      approveNew: false,
    );
  }

  @override
  Future<JoinedMember> join(String token, String displayName) async {
    if (joinError != null) throw joinError!;
    joinedNames.add(displayName);
    return JoinedMember(
      id: 'm1',
      groupId: 'g1',
      displayName: displayName,
      status: memberStatus,
    );
  }

  @override
  Future<JoinedMember> returning(
    String token,
    String displayName,
    String pin,
  ) async {
    if (returningError != null) throw returningError!;
    return JoinedMember(
      id: 'm1',
      groupId: 'g1',
      displayName: displayName,
      status: 'active',
    );
  }

  @override
  Future<void> setPin(String pin) async {}

  @override
  Future<String> myStatus() async => memberStatus;
}

void main() {
  group('JoinViewModel', () {
    late FakeJoinRepository repository;
    late JoinViewModel viewModel;

    setUp(() {
      repository = FakeJoinRepository();
      viewModel = JoinViewModel(repository, token: 'token-1234567890abcd');
    });

    test('should show the group name after loading the preview', () async {
      await viewModel.load();
      expect(viewModel.status, JoinStatus.ready);
      expect(viewModel.groupName, 'Office');
      expect(viewModel.memberCount, 3);
    });

    test('should show closed on 410', () async {
      repository.previewError = ApiException(410, code: 'invite_closed');
      await viewModel.load();
      expect(viewModel.status, JoinStatus.closed);
    });

    test('should show nameTaken on 409', () async {
      await viewModel.load();
      repository.joinError = ApiException(409, code: 'name_taken');
      await viewModel.submit('Olena');
      expect(viewModel.status, JoinStatus.nameTaken);
    });

    test('should show full when the group has no places', () async {
      await viewModel.load();
      repository.joinError = ApiException(422, code: 'group_full');
      await viewModel.submit('Olena');
      expect(viewModel.status, JoinStatus.full);
    });

    test('should show pending when the server returns pending', () async {
      await viewModel.load();
      repository.memberStatus = 'pending';
      await viewModel.submit('Olena');
      expect(viewModel.status, JoinStatus.pending);
    });

    test('should join with a trimmed name', () async {
      await viewModel.load();
      await viewModel.submit('  Olena  ');
      expect(viewModel.status, JoinStatus.joined);
      expect(repository.joinedNames, ['Olena']);
      expect(viewModel.member?.groupId, 'g1');
    });

    test('should refuse an empty name without calling the server', () async {
      await viewModel.load();
      await viewModel.submit('   ');
      expect(viewModel.status, JoinStatus.invalidName);
      expect(repository.joinedNames, isEmpty);
    });

    test(
      'should not let an organizer replace their session by joining their own link',
      () async {
        final organizerView = JoinViewModel(
          repository,
          token: 'token-1234567890abcd',
          isOrganizerSignedIn: () async => true,
        );
        await organizerView.load();
        expect(organizerView.status, JoinStatus.organizerSignedIn);
        await organizerView.submit('Olena');
        expect(repository.joinedNames, isEmpty);
      },
    );

    test('should report a network failure', () async {
      repository.previewError = NetworkException('offline');
      await viewModel.load();
      expect(viewModel.status, JoinStatus.networkError);
    });
  });

  group('ReturningViewModel', () {
    late FakeJoinRepository repository;
    late ReturningViewModel viewModel;

    setUp(() {
      repository = FakeJoinRepository();
      viewModel = ReturningViewModel(repository, token: 'token-1234567890abcd');
    });

    test('should show attempts left after a wrong PIN', () async {
      repository.returningError = ApiException(
        401,
        code: 'wrong_pin',
        details: {'attemptsLeft': 3},
      );
      await viewModel.submit('Olena', '0000');
      expect(viewModel.status, ReturningStatus.wrongPin);
      expect(viewModel.attemptsLeft, 3);
    });

    test('should show the lock in whole minutes', () async {
      repository.returningError = ApiException(
        429,
        code: 'pin_locked',
        details: {'retryAfterSeconds': 850},
      );
      await viewModel.submit('Olena', '0000');
      expect(viewModel.status, ReturningStatus.locked);
      expect(viewModel.lockedMinutes, 15);
    });

    test('should reject a PIN that is not 4 digits locally', () async {
      await viewModel.submit('Olena', '12a');
      expect(viewModel.status, ReturningStatus.invalidPin);
    });

    test('should sign in with the right PIN', () async {
      await viewModel.submit('Olena', '1234');
      expect(viewModel.status, ReturningStatus.signedIn);
      expect(viewModel.member?.id, 'm1');
    });
  });
}
