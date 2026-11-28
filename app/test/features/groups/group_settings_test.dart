import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/group_home_view_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/testing.dart';

class _SettingsRepository implements GroupsRepository {
  bool likesCountOnly = false;
  Object? error;
  final sent = <bool>[];

  @override
  Future<GroupSummary> group(String groupId) async => GroupSummary(
    id: groupId,
    name: 'Office',
    ownerUid: 'org',
    likesCountOnly: likesCountOnly,
  );

  @override
  Future<List<GroupMember>> members(String groupId) async => const [];

  @override
  Future<void> setLikesCountOnly(String groupId, bool value) async {
    if (error != null) throw error!;
    sent.add(value);
    likesCountOnly = value;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName}');
}

void main() {
  group('GroupSummary', () {
    test('should be false by default', () {
      const summary = GroupSummary(id: 'g', name: 'n', ownerUid: 'o');

      expect(summary.likesCountOnly, isFalse);
    });
  });

  group('GroupHomeViewModel likes-count-only switch', () {
    late _SettingsRepository repository;
    late GroupHomeViewModel viewModel;

    setUp(() {
      repository = _SettingsRepository();
      viewModel = GroupHomeViewModel(
        repository,
        FakeRealtimeClient(),
        groupId: 'g1',
        isOwner: true,
      )..start();
    });

    tearDown(() => viewModel.dispose());

    test('should read the current setting with the group', () async {
      repository.likesCountOnly = true;
      await pumpEventQueue();

      expect(viewModel.likesCountOnly, isTrue);
    });

    test('should switch it on at once and tell the server', () async {
      await pumpEventQueue();
      final pending = viewModel.setLikesCountOnly(true);

      expect(viewModel.likesCountOnly, isTrue);
      await pending;
      expect(repository.sent, [true]);
    });

    test('should switch it back off', () async {
      repository.likesCountOnly = true;
      await pumpEventQueue();
      await viewModel.setLikesCountOnly(false);

      expect(viewModel.likesCountOnly, isFalse);
      expect(repository.sent, [false]);
    });

    test('should roll the switch back when the server refuses', () async {
      await pumpEventQueue();
      repository.error = NetworkException('offline');
      await viewModel.setLikesCountOnly(true);

      expect(viewModel.likesCountOnly, isFalse);
      expect(viewModel.loadFailed, isTrue);
    });
  });
}
