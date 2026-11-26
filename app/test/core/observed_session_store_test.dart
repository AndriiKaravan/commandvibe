import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:flutter_test/flutter_test.dart';

class MemoryStore implements SessionStore {
  StoredSession? value;

  @override
  Future<StoredSession?> read() async => value;

  @override
  Future<void> write(StoredSession session) async => value = session;

  @override
  Future<void> clear() async => value = null;
}

const _session = StoredSession(
  accessToken: 'a',
  refreshToken: 'r',
  expiresAt: 1,
  kind: 'member',
  groupId: 'g',
);

void main() {
  group('ObservedSessionStore', () {
    test(
      'should notify when the session is cleared so the router can leave protected pages',
      () async {
        final store = ObservedSessionStore(MemoryStore());
        var notified = 0;
        store.addListener(() => notified++);
        await store.write(_session);
        await store.clear();
        expect(notified, 2);
        expect(await store.read(), isNull);
      },
    );
  });
}
