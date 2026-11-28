import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/comments/data/comments_models.dart';
import 'package:commandvibe/features/comments/data/comments_repository.dart';
import 'package:commandvibe/features/comments/ui/comments_view_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

CommentItem _comment(String id, String text, {bool mine = false}) =>
    CommentItem(
      id: id,
      memberId: mine ? 'me' : 'other',
      displayName: mine ? 'Я' : 'Інший',
      text: text,
      createdAt: DateTime.utc(2026, 12, 2, 8),
      mine: mine,
      canDelete: mine,
    );

class _FakeComments implements CommentsRepository {
  final stored = <CommentItem>[];
  final added = <String>[];
  final deleted = <String>[];
  Object? error;
  int lists = 0;

  @override
  Future<List<CommentItem>> list(
    String groupId,
    int dayIndex,
    String authorMemberId,
  ) async {
    lists++;
    if (error != null) throw error!;
    return List.of(stored);
  }

  @override
  Future<CommentItem> add(
    String groupId,
    int dayIndex,
    String authorMemberId,
    String text,
  ) async {
    if (error != null) throw error!;
    added.add(text);
    final item = _comment('c${added.length}', text, mine: true);
    stored.add(item);
    return item;
  }

  @override
  Future<void> delete(
    String groupId,
    int dayIndex,
    String authorMemberId,
    String commentId,
  ) async {
    if (error != null) throw error!;
    deleted.add(commentId);
    stored.removeWhere((c) => c.id == commentId);
  }
}

RealtimeEvent _event(String type) => RealtimeEvent(
  topic: 'group:g1',
  type: type,
  data: const {'dayIndex': 0, 'memberId': 'author'},
  id: 'e-$type',
  serverTime: DateTime.utc(2026, 12),
);

void main() {
  group('CommentsViewModel', () {
    late _FakeComments repository;
    late FakeRealtimeClient realtime;
    late CommentsViewModel viewModel;

    setUp(() {
      repository = _FakeComments();
      realtime = FakeRealtimeClient();
      viewModel = CommentsViewModel(
        repository,
        realtime,
        groupId: 'g1',
        dayIndex: 0,
        authorMemberId: 'author',
      )..start();
    });

    tearDown(() => viewModel.dispose());

    test('should load the comments when the topic is confirmed', () async {
      repository.stored.add(_comment('c0', 'Привіт'));
      await pumpEventQueue();
      realtime.emitTopicResync('group:g1');
      await pumpEventQueue();

      expect(viewModel.items.map((c) => c.text), ['Привіт']);
      expect(viewModel.isLoaded, isTrue);
    });

    test('should send a trimmed comment and show it', () async {
      await pumpEventQueue();
      await viewModel.send('  Гарно!  ');

      expect(repository.added, ['Гарно!']);
      expect(viewModel.items.map((c) => c.text), ['Гарно!']);
      expect(viewModel.error, isNull);
    });

    test('should not send an empty or blank comment', () async {
      await pumpEventQueue();
      await viewModel.send('');
      await viewModel.send('   \n ');

      expect(repository.added, isEmpty);
      expect(viewModel.error, CommentError.empty);
    });

    test(
      'should refuse a comment over 500 characters without asking the server, counting emoji once',
      () async {
        await pumpEventQueue();
        await viewModel.send('я' * 501);
        expect(repository.added, isEmpty);
        expect(viewModel.error, CommentError.tooLong);

        await viewModel.send('😀' * 500);
        expect(repository.added, hasLength(1));
        expect(viewModel.error, isNull);
      },
    );

    test('should clear the error after a good send', () async {
      await pumpEventQueue();
      await viewModel.send('');
      await viewModel.send('ok');

      expect(viewModel.error, isNull);
    });

    test('should flag a failed send and keep what was there', () async {
      repository.stored.add(_comment('c0', 'старе'));
      await pumpEventQueue();
      realtime.emitTopicResync('group:g1');
      await pumpEventQueue();
      repository.error = NetworkException('offline');
      await viewModel.send('нове');

      expect(viewModel.error, CommentError.failed);
      expect(viewModel.items.map((c) => c.text), ['старе']);
    });

    test('should delete a comment and drop it from the list', () async {
      repository.stored.add(_comment('c0', 'моє', mine: true));
      await pumpEventQueue();
      realtime.emitTopicResync('group:g1');
      await pumpEventQueue();
      await viewModel.delete('c0');

      expect(repository.deleted, ['c0']);
      expect(viewModel.items, isEmpty);
    });

    test('should reload when someone else comments or deletes', () async {
      await pumpEventQueue();
      realtime.emitTopicResync('group:g1');
      await pumpEventQueue();
      final before = repository.lists;
      repository.stored.add(_comment('c9', 'від іншого'));
      realtime.emit(_event('comment.created'));
      await pumpEventQueue();

      expect(repository.lists, greaterThan(before));
      expect(viewModel.items.map((c) => c.text), ['від іншого']);
    });

    test('should ignore a second send while the first is on its way', () async {
      await pumpEventQueue();
      final first = viewModel.send('один');
      final second = viewModel.send('два');
      await Future.wait([first, second]);

      expect(repository.added, ['один']);
    });
  });
}
