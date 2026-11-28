import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/feed/data/feed_models.dart';
import 'package:commandvibe/features/feed/data/feed_repository.dart';
import 'package:commandvibe/features/feed/ui/feed_view_model.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

FeedItem _item(int day, String member) => FeedItem(
  photo: SubmissionItem(
    memberId: member,
    displayName: member,
    submittedAt: DateTime.utc(2026, 12, 1 + day),
    access: PhotoAccess.full,
    photoUrl: Uri.parse('https://api.test/p/$day-$member'),
    blurUrl: Uri.parse('https://api.test/p/$day-$member-blur'),
    width: 10,
    height: 10,
    mine: false,
  ),
  dayIndex: day,
  taskTitle: const TaskText(uk: 'Завдання'),
  revealAt: DateTime.utc(2026, 12, 3 + day, 7),
);

class _FakeFeed implements FeedRepository {
  /// Newest first, as the server returns them.
  List<FeedItem> all = [for (var i = 5; i >= 1; i--) _item(i, 'm$i')];
  final requests = <({FeedFilter filter, String? before, int limit})>[];
  Object? error;
  Completer<void>? gate;

  @override
  Future<FeedPage> page(
    String groupId, {
    FeedFilter filter = const FeedFilter(),
    String? before,
    int limit = 20,
  }) async {
    requests.add((filter: filter, before: before, limit: limit));
    final answer = _answer(filter, before, limit);
    if (gate != null) await gate!.future;
    if (error != null) throw error!;
    return answer;
  }

  FeedPage _answer(FeedFilter filter, String? before, int limit) {
    final matching = all
        .where((i) => filter.day == null || i.dayIndex == filter.day)
        .where(
          (i) => filter.memberId == null || i.photo.memberId == filter.memberId,
        )
        .toList();
    final start = before == null ? 0 : int.parse(before);
    final slice = matching.skip(start).take(limit).toList();
    final end = start + slice.length;
    return FeedPage(items: slice, next: end < matching.length ? '$end' : null);
  }
}

RealtimeEvent _event(String type) => RealtimeEvent(
  topic: 'group:g1',
  type: type,
  data: const {},
  id: 'e-$type',
  serverTime: DateTime.utc(2026, 12),
);

void main() {
  group('FeedViewModel', () {
    late _FakeFeed repository;
    late FakeRealtimeClient realtime;
    late FeedViewModel viewModel;
    late DateTime now;

    setUp(() {
      repository = _FakeFeed();
      realtime = FakeRealtimeClient();
      now = DateTime.utc(2026, 12, 1, 10);
      viewModel = FeedViewModel(
        repository,
        realtime,
        groupId: 'g1',
        pageSize: 2,
        clock: () => now,
      );
    });

    tearDown(() => viewModel.dispose());

    test('should load the first page when started', () async {
      viewModel.start();
      await pumpEventQueue();

      expect(viewModel.items.map((i) => i.key), ['5/m5', '4/m4']);
      expect(viewModel.hasMore, isTrue);
    });

    test('should append the next page without duplicates', () async {
      viewModel.start();
      await pumpEventQueue();
      await viewModel.loadMore();
      await viewModel.loadMore();

      expect(viewModel.items.map((i) => i.key), [
        '5/m5',
        '4/m4',
        '3/m3',
        '2/m2',
        '1/m1',
      ]);
      expect(viewModel.hasMore, isFalse);
    });

    test('should ask for the next page only once at a time', () async {
      viewModel.start();
      await pumpEventQueue();
      repository.gate = Completer<void>();
      final first = viewModel.loadMore();
      final second = viewModel.loadMore();
      repository.gate!.complete();
      await Future.wait([first, second]);

      expect(repository.requests.where((r) => r.before != null), hasLength(1));
    });

    test('should not ask past the last page', () async {
      repository.all = [_item(1, 'm1')];
      viewModel.start();
      await pumpEventQueue();
      final before = repository.requests.length;
      await viewModel.loadMore();

      expect(viewModel.hasMore, isFalse);
      expect(repository.requests.length, before);
    });

    test('should start over with a new filter', () async {
      viewModel.start();
      await pumpEventQueue();
      await viewModel.loadMore();
      await viewModel.setFilter(const FeedFilter(day: 2));

      expect(viewModel.filter, const FeedFilter(day: 2));
      expect(viewModel.items.map((i) => i.key), ['2/m2']);
      expect(repository.requests.last.filter, const FeedFilter(day: 2));
      expect(repository.requests.last.before, isNull);
    });

    test(
      'should drop an answer that arrives after the filter changed',
      () async {
        viewModel.start();
        await pumpEventQueue();
        final gate = Completer<void>();
        repository.gate = gate;
        final stale = viewModel.setFilter(const FeedFilter(day: 1));
        repository.gate = null;
        await viewModel.setFilter(const FeedFilter(day: 3));
        gate.complete();
        await stale;

        expect(viewModel.items.map((i) => i.key), ['3/m3']);
      },
    );

    test(
      'should refresh what is already loaded when something changes',
      () async {
        viewModel.start();
        await pumpEventQueue();
        await viewModel.loadMore();
        repository.all = [_item(6, 'm6'), ...repository.all];
        realtime.emit(_event('submission.created'));
        await pumpEventQueue();

        expect(viewModel.items.first.key, '6/m6');
        expect(viewModel.items.length, greaterThanOrEqualTo(4));
      },
    );

    test(
      'should not lose an item when a refresh overlaps a page load',
      () async {
        viewModel.start();
        await pumpEventQueue();
        final gate = Completer<void>();
        repository.gate = gate;
        final more = viewModel.loadMore();
        repository.gate = null;
        repository.all = [_item(6, 'm6'), ...repository.all];
        await viewModel.refresh();
        gate.complete();
        await more;

        final keys = viewModel.items.map((i) => i.key).toList();
        expect(
          keys,
          repository.all.take(keys.length).map((i) => i.key).toList(),
        );
      },
    );

    test('should keep the newest answer when refreshes overlap', () async {
      viewModel.start();
      await pumpEventQueue();
      final gate = Completer<void>();
      repository.gate = gate;
      final first = viewModel.refresh();
      repository.gate = null;
      repository.all = [_item(6, 'm6'), ...repository.all];
      final second = viewModel.refresh();
      gate.complete();
      await Future.wait([first, second]);

      expect(viewModel.items.first.key, '6/m6');
    });

    test('should not refresh again at once for every failing image', () async {
      viewModel.start();
      await pumpEventQueue();
      final before = repository.requests.length;

      viewModel.imageFailed();
      viewModel.imageFailed();
      await pumpEventQueue();
      expect(repository.requests.length, before);

      now = now.add(const Duration(seconds: 31));
      viewModel.imageFailed();
      viewModel.imageFailed();
      await pumpEventQueue();
      expect(repository.requests.length, before + 1);
    });

    test('should ignore events about other things', () async {
      viewModel.start();
      await pumpEventQueue();
      final before = repository.requests.length;
      realtime.emit(_event('roulette.spin'));
      await pumpEventQueue();

      expect(repository.requests.length, before);
    });

    test('should keep the list and flag a failed load', () async {
      viewModel.start();
      await pumpEventQueue();
      repository.error = NetworkException('offline');
      await viewModel.loadMore();

      expect(viewModel.items, hasLength(2));
      expect(viewModel.loadFailed, isTrue);
      repository.error = null;
      await viewModel.loadMore();
      expect(viewModel.loadFailed, isFalse);
    });
  });
}
