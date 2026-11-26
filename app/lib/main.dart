import 'package:commandvibe/app.dart';
import 'package:commandvibe/core/firebase_options.dart';
import 'package:commandvibe/core/telemetry_setup.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

Future<void> main() => bootstrap();

/// Starts the app; integration tests pass `telemetry: false` because Crashlytics takes over FlutterError.onError.
Future<void> bootstrap({bool telemetry = true}) async {
  WidgetsFlutterBinding.ensureInitialized();
  // The server's invite page sends people to /join?t=…, a path URL.
  usePathUrlStrategy();
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(options: firebaseOptionsFor(Uri.base));
  }
  if (telemetry) {
    await setUpTelemetry(appVersion: '0.1.0');
  }
  runApp(await CommandVibeApp.create());
}
