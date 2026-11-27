import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class MemorySessionStore implements SessionStore {
  MemorySessionStore([this.session]);

  StoredSession? session;

  @override
  Future<StoredSession?> read() async => session;

  @override
  Future<void> write(StoredSession value) async => session = value;

  @override
  Future<void> clear() async => session = null;
}

const _old = StoredSession(
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: 100,
  kind: 'member',
  groupId: 'g1',
);

http.Response _json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

void main() {
  group('ApiClient', () {
    late MemorySessionStore store;
    late int refreshCalls;

    setUp(() {
      store = MemorySessionStore(_old);
      refreshCalls = 0;
    });

    ApiClient clientWith(
      Future<http.Response> Function(http.Request request) handler,
    ) => ApiClient(
      baseUri: Uri.parse('https://api.test'),
      sessionStore: store,
      client: MockClient(handler),
      realtimeSessionId: () => 'sid-1',
    );

    Future<http.Response> refreshOk(http.Request request) async {
      refreshCalls++;
      expect(jsonDecode(request.body), {'refreshToken': 'old-refresh'});
      return _json({
        'accessToken': 'new-access',
        'refreshToken': 'new-refresh',
        'expiresAt': 200,
      }, 201);
    }

    test('should send the access token and the realtime session id', () async {
      late http.Request seen;
      final client = clientWith((request) async {
        seen = request;
        return _json({'ok': true});
      });
      expect(await client.get('/me'), {'ok': true});
      expect(seen.headers['authorization'], 'Bearer old-access');
      expect(seen.headers['x-realtime-session'], 'sid-1');
    });

    test('should refresh once and retry on 401', () async {
      final client = clientWith((request) async {
        if (request.url.path == '/auth/refresh') {
          return refreshOk(request);
        }
        if (request.headers['authorization'] == 'Bearer new-access') {
          return _json({'ok': true});
        }
        return _json({'code': 'token_invalid'}, 401);
      });
      expect(await client.get('/me'), {'ok': true});
      expect(refreshCalls, 1);
      expect(store.session?.refreshToken, 'new-refresh');
      expect(store.session?.groupId, 'g1');
    });

    test('should share one refresh between parallel 401s', () async {
      final gate = Completer<void>();
      final client = clientWith((request) async {
        if (request.url.path == '/auth/refresh') {
          await gate.future;
          return refreshOk(request);
        }
        if (request.headers['authorization'] == 'Bearer new-access') {
          return _json({'path': request.url.path});
        }
        return _json({'code': 'token_invalid'}, 401);
      });
      final first = client.get('/a');
      final second = client.get('/b');
      await Future<void>.delayed(Duration.zero);
      gate.complete();
      expect(await Future.wait([first, second]), [
        {'path': '/a'},
        {'path': '/b'},
      ]);
      expect(refreshCalls, 1);
    });

    test('should clear the session when refresh fails', () async {
      final client = clientWith(
        (request) async => _json({'code': 'token_invalid'}, 401),
      );
      await expectLater(
        client.get('/me'),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401),
        ),
      );
      expect(store.session, isNull);
    });

    test('should not refresh on a 401 that is not about the token', () async {
      final client = clientWith((request) async {
        if (request.url.path == '/auth/refresh') {
          return refreshOk(request);
        }
        return _json({'code': 'wrong_pin', 'attemptsLeft': 3}, 401);
      });
      await expectLater(
        client.post('/join/returning', body: {'pin': '0000'}),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'wrong_pin')),
      );
      expect(refreshCalls, 0);
      expect(store.session, isNotNull);
    });

    test('should retry with tokens another refresh already stored', () async {
      final client = clientWith((request) async {
        if (request.url.path == '/auth/refresh') {
          return refreshOk(request);
        }
        if (request.headers['authorization'] == 'Bearer newer-access') {
          return _json({'ok': true});
        }
        // Another tab rotated the tokens while this request was in flight.
        store.session = _old.withTokens(
          accessToken: 'newer-access',
          refreshToken: 'newer-refresh',
          expiresAt: 300,
        );
        return _json({'code': 'token_invalid'}, 401);
      });
      expect(await client.get('/me'), {'ok': true});
      expect(refreshCalls, 0);
    });

    test('should surface the error code from the body', () async {
      final client = clientWith(
        (request) async =>
            _json({'message': 'name_taken', 'statusCode': 409}, 409),
      );
      await expectLater(
        client.post('/join', body: {'displayName': 'Olena'}),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'name_taken'),
        ),
      );
    });

    test(
      'should hand the realtime client a refreshed token when forced',
      () async {
        final client = clientWith((request) async {
          if (request.url.path == '/auth/refresh') {
            return refreshOk(request);
          }
          return http.Response('', 500);
        });
        expect(await client.accessToken(), 'old-access');
        expect(refreshCalls, 0);
        expect(await client.accessToken(forceRefresh: true), 'new-access');
        expect(refreshCalls, 1);
      },
    );

    test(
      'should have no token for the realtime client when signed out',
      () async {
        store.session = null;
        final client = clientWith((request) async => http.Response('', 500));
        expect(await client.accessToken(forceRefresh: true), isNull);
      },
    );

    test('should return null for 204', () async {
      final client = clientWith((request) async => http.Response('', 204));
      expect(await client.put('/me/pin', body: {'pin': '1234'}), isNull);
    });
    group('upload', () {
      ApiClient uploading(
        Future<http.Response> Function(http.Request request) handler,
      ) => ApiClient(
        baseUri: Uri.parse('https://api.test'),
        sessionStore: store,
        client: MockClient(handler),
      );

      final bytes = Uint8List.fromList([0xff, 0xd8, 0xff, 1, 2, 3]);

      test('should send raw bytes with the token and the given type', () async {
        late http.Request seen;
        final client = uploading((request) async {
          seen = request;
          return _json({'ok': true}, 201);
        });
        await client.upload(
          'POST',
          '/groups/g1/days/0/submission?source=camera',
          bytes,
          contentType: 'image/jpeg',
        );
        expect(seen.method, 'POST');
        expect(seen.headers['authorization'], 'Bearer old-access');
        expect(seen.headers['content-type'], startsWith('image/jpeg'));
        expect(seen.bodyBytes, bytes);
        expect(seen.url.queryParameters['source'], 'camera');
      });

      test(
        'should refresh on token_invalid and resend the same bytes',
        () async {
          final bodies = <List<int>>[];
          final client = uploading((request) async {
            if (request.url.path == '/auth/refresh') {
              return refreshOk(request);
            }
            bodies.add(request.bodyBytes);
            if (request.headers['authorization'] == 'Bearer new-access') {
              return _json({'ok': true}, 201);
            }
            return _json({'code': 'token_invalid'}, 401);
          });
          await client.upload('PUT', '/x', bytes, contentType: 'image/png');
          expect(refreshCalls, 1);
          expect(bodies, [bytes, bytes]);
        },
      );

      test(
        'should expose the error body, e.g. the version to replace',
        () async {
          final client = uploading(
            (request) async =>
                _json({'message': 'already_submitted', 'version': 'v9'}, 409),
          );
          await expectLater(
            client.upload('POST', '/x', bytes, contentType: 'image/jpeg'),
            throwsA(
              isA<ApiException>()
                  .having((e) => e.code, 'code', 'already_submitted')
                  .having((e) => e.details['version'], 'version', 'v9'),
            ),
          );
        },
      );
    });
  });
}
