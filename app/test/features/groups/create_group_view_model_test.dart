import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/create_group_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeGroupsRepository implements GroupsRepository {
  CreateGroupRequest? lastRequest;
  Object? error;

  @override
  Future<CreatedGroup> create(CreateGroupRequest request) async {
    if (error != null) throw error!;
    lastRequest = request;
    return const CreatedGroup(
      groupId: 'g1',
      name: 'Office',
      inviteUrl: 'https://app.test/j/abc',
    );
  }

  @override
  Future<String> rotateInvite(String groupId) => throw UnimplementedError();

  @override
  Future<void> setAvatar(String groupId, String? avatar) =>
      throw UnimplementedError();

  @override
  Future<List<OwnedGroup>> owned() => throw UnimplementedError();

  @override
  Future<GroupSummary> group(String groupId) => throw UnimplementedError();

  @override
  Future<List<GroupMember>> members(String groupId) =>
      throw UnimplementedError();

  @override
  Future<void> approve(String groupId, String memberId) =>
      throw UnimplementedError();

  @override
  Future<void> remove(String groupId, String memberId) =>
      throw UnimplementedError();
}

void main() {
  group('CreateGroupViewModel', () {
    late FakeGroupsRepository repository;
    late CreateGroupViewModel viewModel;

    setUp(() {
      repository = FakeGroupsRepository();
      viewModel = CreateGroupViewModel(
        repository,
        timezone: () async => 'Europe/Kyiv',
      );
    });

    test('should default playsToo to true and approveNew to false', () {
      expect(viewModel.playsToo, isTrue);
      expect(viewModel.approveNew, isFalse);
    });

    test('should send the device time zone and the switches', () async {
      viewModel
        ..playsToo = false
        ..approveNew = true;
      await viewModel.create(' Office ');
      expect(
        repository.lastRequest,
        const CreateGroupRequest(
          name: 'Office',
          timezone: 'Europe/Kyiv',
          playsToo: false,
          approveNew: true,
        ),
      );
      expect(viewModel.created?.inviteUrl, 'https://app.test/j/abc');
    });

    test('should not call the server for an empty name', () async {
      await viewModel.create('  ');
      expect(repository.lastRequest, isNull);
      expect(viewModel.error, CreateGroupError.invalidName);
    });

    test('should report a server failure', () async {
      repository.error = ApiException(500);
      await viewModel.create('Office');
      expect(viewModel.error, CreateGroupError.failed);
      expect(viewModel.isBusy, isFalse);
    });
  });
}
