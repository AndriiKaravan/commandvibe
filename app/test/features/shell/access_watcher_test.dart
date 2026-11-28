import 'package:commandvibe/features/shell/access_watcher.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/deniable_realtime.dart';

void main() {
  group('AccessWatcher', () {
    late DeniableRealtime realtime;
    late int revoked;
    late AccessWatcher watcher;

    setUp(() {
      realtime = DeniableRealtime();
      revoked = 0;
      watcher = AccessWatcher(
        realtime,
        groupId: 'g1',
        onRevoked: () => revoked++,
      )..start();
    });

    tearDown(() => watcher.dispose());

    test('should report when the server revokes the member', () {
      realtime.subscriptions['group:g1']!.deny('revoked');

      expect(revoked, 1);
    });

    test('should ignore other reasons for a denied subscription', () {
      realtime.subscriptions['group:g1']!.deny('forbidden');

      expect(revoked, 0);
    });

    test('should stay quiet after being disposed', () {
      final subscription = realtime.subscriptions['group:g1']!;
      watcher.dispose();
      subscription.deny('revoked');

      expect(revoked, 0);
    });
  });
}
