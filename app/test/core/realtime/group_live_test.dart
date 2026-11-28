import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/features/notifications/data/notifications_models.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

void main() {
  group('GroupLive', () {
    late FakeRealtimeClient realtime;
    late int revoked;
    late int progressLoads;
    late int standingsLoads;
    late int notificationLoads;
    Object? failProgress;
    Object? failStandings;
    late GroupLive live;

    setUp(() {
      realtime = FakeRealtimeClient();
      revoked = 0;
      progressLoads = 0;
      standingsLoads = 0;
      notificationLoads = 0;
      failProgress = null;
      failStandings = null;
      live = GroupLive(
        realtime,
        groupId: 'g1',
        loadProgress: () async {
          progressLoads++;
          if (failProgress != null) throw failProgress!;
          return GameProgress(
            days: const [],
            currentDay: null,
            serverTime: DateTime.utc(2026, 12),
          );
        },
        loadStandings: () async {
          standingsLoads++;
          if (failStandings != null) throw failStandings!;
          return const Standings(items: [], me: null);
        },
        loadNotifications: () async {
          notificationLoads++;
          return const NotificationsPage(items: [], unread: 0);
        },
        onRevoked: () => revoked++,
      );
    });

    tearDown(() => live.dispose());

    test(
      'should load progress and standings once for the whole group',
      () async {
        live.start();
        await pumpEventQueue();

        expect(progressLoads, 1);
        expect(standingsLoads, 1);
        expect(live.progress.value, isNotNull);
        expect(live.standings.value, isNotNull);
      },
    );

    test(
      'should report once when the server stops answering this member',
      () async {
        failProgress = ApiException(403);
        failStandings = ApiException(403);
        live.start();
        await pumpEventQueue();

        expect(revoked, 1);
      },
    );

    RealtimeEvent event(String type) => RealtimeEvent(
      topic: 'group:g1',
      type: type,
      data: const {'dayIndex': 0, 'memberId': 'a'},
      id: 'e-$type',
      serverTime: DateTime.utc(2026, 12),
    );

    test(
      'should reload the rating but not the progress when a like arrives',
      () async {
        live.start();
        await pumpEventQueue();
        final progressBefore = progressLoads;
        final standingsBefore = standingsLoads;
        realtime.emit(event('like.changed'));
        await pumpEventQueue();

        expect(progressLoads, progressBefore);
        expect(standingsLoads, standingsBefore + 1);
      },
    );

    test('should reload neither when a comment arrives', () async {
      live.start();
      await pumpEventQueue();
      final progressBefore = progressLoads;
      final standingsBefore = standingsLoads;
      realtime.emit(event('comment.created'));
      await pumpEventQueue();

      expect(progressLoads, progressBefore);
      expect(standingsLoads, standingsBefore);
    });

    test('should not report a plain offline failure', () async {
      failProgress = NetworkException('offline');
      live.start();
      await pumpEventQueue();

      expect(revoked, 0);
    });

    test('should report a refusal that only the standings read gets', () async {
      failStandings = ApiException(404);
      live.start();
      await pumpEventQueue();

      expect(revoked, 1);
    });

    test(
      'should reload only the notifications when one is created or read',
      () async {
        live.start();
        await pumpEventQueue();
        final progressBefore = progressLoads;
        final notificationsBefore = notificationLoads;
        realtime.emit(event('notification.created'));
        realtime.emit(event('notification.read'));
        await pumpEventQueue();

        expect(notificationLoads, greaterThan(notificationsBefore));
        expect(progressLoads, progressBefore);
      },
    );

    test('should load notifications together with the rest', () async {
      live.start();
      await pumpEventQueue();

      expect(live.notifications.value?.unread, 0);
    });
  });
}
