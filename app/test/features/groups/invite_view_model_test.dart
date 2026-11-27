import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/invite_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

class _RotatingRepository implements GroupsRepository {
  int rotations = 0;
  Object? error;

  @override
  Future<String> rotateInvite(String groupId) async {
    if (error != null) throw error!;
    rotations++;
    return 'https://app.test/j/new-$groupId';
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName}');
}

void main() {
  group('InviteViewModel', () {
    late _RotatingRepository repository;
    late InviteViewModel viewModel;

    setUp(() {
      repository = _RotatingRepository();
      viewModel = InviteViewModel(repository, groupId: 'g1');
    });

    tearDown(() => viewModel.dispose());

    test('should not replace the link until asked', () {
      expect(viewModel.inviteUrl, isNull);
      expect(repository.rotations, 0);
    });

    test('should expose the new link after rotating', () async {
      await viewModel.rotate();

      expect(viewModel.inviteUrl, 'https://app.test/j/new-g1');
      expect(viewModel.failed, isFalse);
    });

    test('should report a failure and allow another try', () async {
      repository.error = NetworkException('offline');
      await viewModel.rotate();
      expect(viewModel.failed, isTrue);
      expect(viewModel.inviteUrl, isNull);

      repository.error = null;
      await viewModel.rotate();
      expect(viewModel.failed, isFalse);
      expect(viewModel.inviteUrl, isNotNull);
    });

    test('should ignore a second tap while the first is running', () async {
      final first = viewModel.rotate();
      final second = viewModel.rotate();
      await Future.wait([first, second]);

      expect(repository.rotations, 1);
    });
  });
}
