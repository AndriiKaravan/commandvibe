import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:commandvibe/features/join/ui/pending_view_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

class StatusJoinRepository implements JoinRepository {
  String status = 'pending';
  int reads = 0;

  @override
  Future<String> myStatus() async {
    reads++;
    return status;
  }

  @override
  Future<InvitePreview> preview(String token) => throw UnimplementedError();

  @override
  Future<JoinedMember> join(String token, String displayName) =>
      throw UnimplementedError();

  @override
  Future<JoinedMember> returning(
    String token,
    String displayName,
    String pin,
  ) => throw UnimplementedError();

  @override
  Future<void> setPin(String pin) => throw UnimplementedError();
}

void main() {
  group('PendingViewModel', () {
    late StatusJoinRepository repository;
    late FakeRealtimeClient realtime;
    late PendingViewModel viewModel;

    setUp(() {
      repository = StatusJoinRepository();
      realtime = FakeRealtimeClient();
      viewModel = PendingViewModel(repository, realtime, memberId: 'm1');
    });

    tearDown(() => viewModel.dispose());

    test('should wait on the personal topic while still pending', () async {
      viewModel.start();
      await pumpEventQueue();
      expect(realtime.subscribedTopics, ['member:m1']);
      expect(viewModel.approved, isFalse);
      expect(repository.reads, 1);
    });

    test('should become approved when the organizer approves', () async {
      viewModel.start();
      await pumpEventQueue();
      repository.status = 'active';
      realtime.emit(
        RealtimeEvent(
          topic: 'member:m1',
          type: 'member.approved',
          data: const {'groupId': 'g1'},
          id: 'e1',
          serverTime: DateTime.utc(2026, 12),
        ),
      );
      await pumpEventQueue();
      expect(viewModel.approved, isTrue);
    });

    test('should notice an approval that happened while offline', () async {
      repository.status = 'active';
      viewModel.start();
      await pumpEventQueue();
      expect(viewModel.approved, isTrue);
    });
  });
}
