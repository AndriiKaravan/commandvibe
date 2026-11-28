import 'package:commandvibe/core/server_clock.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ServerClock', () {
    test(
      'should follow the device clock after syncing, not freeze at the sync moment',
      () {
        final deviceAtSync = DateTime.utc(2026, 12, 3, 6, 0);
        final clock = ServerClock.sync(
          serverTime: DateTime.utc(2026, 12, 3, 6, 5),
          deviceNow: deviceAtSync,
        );

        expect(
          clock.now(deviceNow: deviceAtSync),
          DateTime.utc(2026, 12, 3, 6, 5),
        );
        expect(
          clock.now(deviceNow: deviceAtSync.add(const Duration(minutes: 90))),
          DateTime.utc(2026, 12, 3, 7, 35),
        );
      },
    );

    test('should correct a device clock that runs behind', () {
      final clock = ServerClock.sync(
        serverTime: DateTime.utc(2026, 12, 3, 8),
        deviceNow: DateTime.utc(2026, 12, 3, 7),
      );

      expect(
        clock.now(deviceNow: DateTime.utc(2026, 12, 3, 7, 30)),
        DateTime.utc(2026, 12, 3, 8, 30),
      );
    });

    test('should be the device clock before any sync', () {
      final device = DateTime.utc(2026, 12, 3, 9);

      expect(const ServerClock.device().now(deviceNow: device), device);
    });
  });
}
