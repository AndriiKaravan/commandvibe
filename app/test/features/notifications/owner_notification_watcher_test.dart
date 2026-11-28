import 'package:commandvibe/features/notifications/ui/owner_notification_watcher.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

RealtimeEvent _event(String topic, String type) => RealtimeEvent(
  topic: topic,
  type: type,
  data: const {},
  id: 'e',
  serverTime: DateTime.utc(2026, 12),
);

void main() {
  group('OwnerNotificationWatcher', () {
    late FakeRealtimeClient realtime;
    late int changes;
    late OwnerNotificationWatcher watcher;

    setUp(() {
      realtime = FakeRealtimeClient();
      changes = 0;
      watcher = OwnerNotificationWatcher(
        realtime,
        groupId: 'g1',
        onChange: () => changes++,
      );
    });

    tearDown(() => watcher.dispose());

    test(
      'should report a service entry created or read on the owner topic',
      () async {
        realtime.emit(_event('org:g1', 'notification.created'));
        realtime.emit(_event('org:g1', 'notification.read'));
        await pumpEventQueue();

        expect(changes, 2);
      },
    );

    test('should ignore other events and other groups', () async {
      realtime.emit(_event('org:g1', 'complaint.created'));
      realtime.emit(_event('org:g2', 'notification.created'));
      await pumpEventQueue();

      expect(changes, 0);
    });
  });
}
