import 'package:commandvibe/core/push/session_http_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('SessionHttpClient', () {
    test('should add the access token', () async {
      String? sent;
      final client = SessionHttpClient(
        MockClient((request) async {
          sent = request.headers['authorization'];
          return http.Response('', 204);
        }),
        accessToken: ({required bool forceRefresh}) async => 'tok',
      );

      await client.put(Uri.parse('https://api.test/me/push-token'));

      expect(sent, 'Bearer tok');
    });

    test('should refresh the token once after a 401 and repeat', () async {
      final seen = <String?>[];
      final client = SessionHttpClient(
        MockClient((request) async {
          seen.add(request.headers['authorization']);
          return http.Response('', seen.length == 1 ? 401 : 204);
        }),
        accessToken: ({required bool forceRefresh}) async =>
            forceRefresh ? 'fresh' : 'old',
      );

      final response = await client.put(
        Uri.parse('https://api.test/me/push-token'),
        body: '{}',
      );

      expect(seen, ['Bearer old', 'Bearer fresh']);
      expect(response.statusCode, 204);
    });

    test('should not retry forever when the server keeps refusing', () async {
      var calls = 0;
      final client = SessionHttpClient(
        MockClient((request) async {
          calls++;
          return http.Response('', 401);
        }),
        accessToken: ({required bool forceRefresh}) async => 'tok',
      );

      final response = await client.delete(
        Uri.parse('https://api.test/me/push-token'),
      );

      expect(calls, 2);
      expect(response.statusCode, 401);
    });

    test('should send no header without a session', () async {
      String? sent = 'unset';
      final client = SessionHttpClient(
        MockClient((request) async {
          sent = request.headers['authorization'];
          return http.Response('', 401);
        }),
        accessToken: ({required bool forceRefresh}) async => null,
      );

      await client.put(Uri.parse('https://api.test/me/push-token'));

      expect(sent, isNull);
    });
  });
}
