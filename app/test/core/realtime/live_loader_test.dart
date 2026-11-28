import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

RealtimeEvent _event(String type) => RealtimeEvent(
  topic: 'group:g1',
  type: type,
  data: const {},
  id: 'e-$type',
  serverTime: DateTime.utc(2026, 12),
);

void main() {
  group('LiveLoader', () {
    late FakeRealtimeClient realtime;
    late int loads;
    Object? failWith;
    late LiveLoader<int> loader;

    setUp(() {
      realtime = FakeRealtimeClient();
      loads = 0;
      failWith = null;
      loader = LiveLoader<int>(
        realtime,
        topic: 'group:g1',
        reloadOn: const {'submission.created'},
        load: () async {
          if (failWith != null) throw failWith!;
          return ++loads;
        },
      );
    });

    tearDown(() => loader.dispose());

    test('should load once the topic is confirmed', () async {
      loader.start();
      await pumpEventQueue();

      expect(loader.value, 1);
      expect(loader.isLoaded, isTrue);
    });

    test('should reload on a matching event and ignore others', () async {
      loader.start();
      await pumpEventQueue();
      realtime.emit(_event('submission.created'));
      await pumpEventQueue();
      expect(loader.value, 2);

      realtime.emit(_event('roulette.spin'));
      await pumpEventQueue();
      expect(loader.value, 2);
    });

    test('should reload after a reconnect', () async {
      loader.start();
      await pumpEventQueue();
      realtime.emitTopicResync('group:g1');
      await pumpEventQueue();

      expect(loader.value, 2);
    });

    test('should keep the old value and flag a failed reload', () async {
      loader.start();
      await pumpEventQueue();
      failWith = NetworkException('offline');
      await loader.reload();

      expect(loader.value, 1);
      expect(loader.loadFailed, isTrue);

      failWith = null;
      await loader.reload();
      expect(loader.loadFailed, isFalse);
      expect(loader.value, 2);
    });

    test(
      'should flag a refused session as revoked, but not an offline device',
      () async {
        failWith = NetworkException('offline');
        await loader.reload();
        expect(loader.revoked, isFalse);

        for (final status in [401, 403, 404]) {
          failWith = ApiException(status);
          await loader.reload();
          expect(loader.revoked, isTrue, reason: '$status');
          failWith = null;
          await loader.reload();
          expect(loader.revoked, isFalse);
        }
      },
    );

    test('should not treat a server error as revoked', () async {
      failWith = ApiException(500);
      await loader.reload();

      expect(loader.revoked, isFalse);
      expect(loader.loadFailed, isTrue);
    });

    test('should keep loading after an unexpected error', () async {
      failWith = StateError('boom');
      await expectLater(loader.reload(), throwsStateError);

      failWith = null;
      await loader.reload();
      expect(loader.value, 1);
    });

    test('should survive a malformed answer', () async {
      failWith = TypeError();
      await loader.reload();

      expect(loader.loadFailed, isTrue);
      expect(loader.value, isNull);
    });

    test(
      'should run one more load after a burst of events, not one per event',
      () async {
        final gate = Completer<void>();
        var calls = 0;
        final slow = LiveLoader<int>(
          realtime,
          topic: 'group:g1',
          reloadOn: const {'submission.created'},
          load: () async {
            calls++;
            await gate.future;
            return calls;
          },
        )..start();
        await pumpEventQueue();
        for (var i = 0; i < 5; i++) {
          realtime.emit(_event('submission.created'));
        }
        // The events arrive while the first load is still running.
        await pumpEventQueue();
        gate.complete();
        await pumpEventQueue();

        expect(calls, 2);
        expect(slow.value, 2);
        slow.dispose();
      },
    );

    test('should not publish a result after being disposed', () async {
      final pendingResult = Completer<int>();
      final other = LiveLoader<int>(
        realtime,
        topic: 'group:g1',
        reloadOn: const {},
        load: () => pendingResult.future,
      );
      final pending = other.reload();
      other.dispose();
      pendingResult.complete(5);
      await pending;

      expect(other.value, isNull);
    });
  });
}
