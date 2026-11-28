import 'dart:convert';

import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:commandvibe/core/push/app_push.dart';
import 'package:commandvibe/core/push/push_gateway_testing.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class _MemoryStore implements SessionStore {
  StoredSession? session;

  @override
  Future<StoredSession?> read() async => session;

  @override
  Future<void> write(StoredSession value) async => session = value;

  @override
  Future<void> clear() async => session = null;
}

StoredSession _member(String id) {
  String part(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return StoredSession(
    accessToken:
        '${part({'alg': 'x'})}.${part({'sub': id, 'kind': 'member'})}.s',
    refreshToken: 'r',
    expiresAt: 1,
    kind: 'member',
    groupId: 'g',
  );
}

void main() {
  group('AppPush', () {
    late _MemoryStore inner;
    late ObservedSessionStore sessions;
    late FakePushService service;
    late List<({String method, String? token, bool signedIn, String body})>
    requests;
    late AppPush push;

    setUp(() {
      inner = _MemoryStore();
      sessions = ObservedSessionStore(inner);
      service = FakePushService();
      requests = [];
      final client = MockClient((request) async {
        requests.add((
          method: request.method,
          token: request.headers['authorization'],
          signedIn: inner.session != null,
          body: request.body,
        ));
        return http.Response('', 204);
      });
      push = AppPush(
        service: service,
        client: client,
        endpoint: Uri.parse('https://api.test/me/push-token'),
        sessions: sessions,
        platform: 'android',
      )..start();
    });

    tearDown(() async {
      await push.dispose();
      sessions.dispose();
    });

    test('should register the device token after sign-in', () async {
      await sessions.write(_member('m1'));
      await pumpEventQueue();

      expect(requests, hasLength(1));
      expect(requests.single.method, 'PUT');
      expect(jsonDecode(requests.single.body), {
        'token': 'fake-push-token',
        'platform': 'android',
      });
    });

    test('should not register anything while signed out', () async {
      service.emitTokenChange('refreshed');
      await pumpEventQueue();

      expect(requests, isEmpty);
    });

    test('should register a refreshed token while signed in', () async {
      await sessions.write(_member('m1'));
      await pumpEventQueue();
      service.emitTokenChange('refreshed');
      await pumpEventQueue();

      expect(jsonDecode(requests.last.body)['token'], 'refreshed');
    });

    test(
      'should remove the token while still signed in, then sign out',
      () async {
        await sessions.write(_member('m1'));
        await pumpEventQueue();
        await push.signOut();

        final delete = requests.last;
        expect(delete.method, 'DELETE');
        expect(delete.signedIn, isTrue);
        expect(inner.session, isNull);
      },
    );
  });
}
