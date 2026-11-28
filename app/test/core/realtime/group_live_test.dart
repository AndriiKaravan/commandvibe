import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/testing.dart';

void main() {
  group('GroupLive', () {
    late FakeRealtimeClient realtime;
    late int revoked;
    late int progressLoads;
    late int standingsLoads;
    Object? failProgress;
    Object? failStandings;
    late GroupLive live;

    setUp(() {
      realtime = FakeRealtimeClient();
      revoked = 0;
      progressLoads = 0;
      standingsLoads = 0;
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
  });
}
