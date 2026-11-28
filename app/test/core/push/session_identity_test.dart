import 'dart:convert';

import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:commandvibe/core/push/session_identity.dart';
import 'package:flutter_test/flutter_test.dart';

class _MemoryStore implements SessionStore {
  StoredSession? session;

  @override
  Future<StoredSession?> read() async => session;

  @override
  Future<void> write(StoredSession value) async => session = value;

  @override
  Future<void> clear() async => session = null;
}

String _jwt(Map<String, Object?> claims) {
  String part(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${part({'alg': 'HS256'})}.${part(claims)}.sig';
}

StoredSession _session(String kind, String sub, {String? groupId}) =>
    StoredSession(
      accessToken: _jwt({'sub': sub, 'kind': kind, 'gid': groupId}),
      refreshToken: 'r',
      expiresAt: 1,
      kind: kind,
      groupId: groupId,
    );

void main() {
  group('accountOf', () {
    test('should name the account by kind and subject', () {
      expect(accountOf(_session('organizer', 'u1')), 'organizer:u1');
      expect(accountOf(_session('member', 'm1', groupId: 'g')), 'member:m1');
    });

    test('should be null without a session or with an unreadable token', () {
      expect(accountOf(null), isNull);
      const broken = StoredSession(
        accessToken: 'not-a-token',
        refreshToken: 'r',
        expiresAt: 1,
        kind: 'member',
      );
      expect(accountOf(broken), isNull);
    });
  });

  group('signedInAccounts', () {
    late _MemoryStore inner;
    late ObservedSessionStore store;

    setUp(() {
      inner = _MemoryStore();
      store = ObservedSessionStore(inner);
    });

    tearDown(() => store.dispose());

    test('should follow sign-in, a token refresh and sign-out', () async {
      final seen = <String?>[];
      final subscription = signedInAccounts(store).listen(seen.add);
      await pumpEventQueue();
      await store.write(_session('member', 'm1', groupId: 'g'));
      await pumpEventQueue();
      await store.write(_session('member', 'm1', groupId: 'g'));
      await pumpEventQueue();
      await store.clear();
      await pumpEventQueue();
      await store.write(_session('organizer', 'u1'));
      await pumpEventQueue();
      await subscription.cancel();

      expect(seen, [null, 'member:m1', null, 'organizer:u1']);
    });
  });
}
