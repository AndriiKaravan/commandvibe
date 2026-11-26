import 'dart:convert';

import 'package:commandvibe/core/app_config.dart';
import 'package:commandvibe/main.dart' as app;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:integration_test/integration_test.dart';

/// Needs the server in test mode: `cd server && npm run build && PORT=3000 npm run start:test`.
Future<Map<String, dynamic>> _post(
  String path,
  Map<String, Object> body,
) async {
  final response = await http.post(
    AppConfig.apiUri.resolve(path),
    headers: {'content-type': 'application/json'},
    body: jsonEncode(body),
  );
  expect(response.statusCode, 201, reason: response.body);
  return jsonDecode(response.body) as Map<String, dynamic>;
}

Future<void> _pumpUntil(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 20),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 200));
    if (finder.evaluate().isNotEmpty) {
      return;
    }
  }
  final texts = tester
      .widgetList<Text>(find.byType(Text))
      .map((t) => t.data)
      .join(' | ');
  throw TestFailure('timed out waiting for $finder; on screen: $texts');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('join flow', () {
    testWidgets('should join by link, set a PIN and see a new member live', (
      tester,
    ) async {
      final seeded = await _post('/test/seed-group', {'name': 'Integration'});
      final token = seeded['token'] as String;

      await app.bootstrap(telemetry: false);
      await _pumpUntil(tester, find.byKey(const Key('invite-link')));
      await tester.enterText(
        find.byKey(const Key('invite-link')),
        'https://commandvibe.karavanstudio.dev/j/$token',
      );
      await tester.tap(find.byKey(const Key('open-invite')));
      await _pumpUntil(tester, find.byKey(const Key('join-name')));
      expect(find.textContaining('Integration'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('join-name')), 'Native');
      await tester.tap(find.byKey(const Key('join-submit')));
      await _pumpUntil(tester, find.byKey(const Key('pin-field')));
      await tester.enterText(find.byKey(const Key('pin-field')), '2468');
      await tester.tap(find.byKey(const Key('pin-save')));
      await _pumpUntil(tester, find.text('Native'));

      await _post('/join', {'token': token, 'displayName': 'Other'});
      await _pumpUntil(tester, find.text('Other'));
    });
  });
}
