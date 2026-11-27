import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/my_groups_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

class _OwnedRepository implements GroupsRepository {
  List<OwnedGroup> groups = const [];
  Object? error;

  @override
  Future<List<OwnedGroup>> owned() async {
    if (error != null) throw error!;
    return groups;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName}');
}

OwnedGroup _group(String id) =>
    OwnedGroup(id: id, name: 'Group $id', status: 'draft', activeMembers: 1);

void main() {
  group('MyGroupsViewModel', () {
    late _OwnedRepository repository;
    late MyGroupsViewModel viewModel;

    setUp(() {
      repository = _OwnedRepository();
      viewModel = MyGroupsViewModel(repository);
    });

    tearDown(() => viewModel.dispose());

    test('should send an organizer without groups to group creation', () async {
      await viewModel.load();

      expect(viewModel.autoDestination(showAll: false), '/org/new');
    });

    test('should open the only group at once', () async {
      repository.groups = [_group('g1')];
      await viewModel.load();

      expect(viewModel.autoDestination(showAll: false), '/g/g1');
    });

    test(
      'should keep the list for a single group when asked to show all',
      () async {
        repository.groups = [_group('g1')];
        await viewModel.load();

        expect(viewModel.autoDestination(showAll: true), isNull);
      },
    );

    test('should wait for a choice among several groups', () async {
      repository.groups = [_group('g1'), _group('g2')];
      await viewModel.load();

      expect(viewModel.autoDestination(showAll: false), isNull);
      expect(viewModel.groups, hasLength(2));
    });

    test('should not redirect after a failed load', () async {
      repository.error = NetworkException('offline');
      await viewModel.load();

      expect(viewModel.status, MyGroupsStatus.failed);
      expect(viewModel.autoDestination(showAll: false), isNull);
    });

    test('should recover on retry after a failure', () async {
      repository.error = NetworkException('offline');
      await viewModel.load();
      repository.error = null;
      repository.groups = [_group('g1')];
      await viewModel.load();

      expect(viewModel.status, MyGroupsStatus.loaded);
    });
  });
}
