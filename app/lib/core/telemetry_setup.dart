import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// Crash sink for the web: Crashlytics has no web implementation, so errors go to the console.
///
/// Temporary until ks_core gains web support (hub task ks_core/2026-11-26-web-support).
class ConsoleCrashSink implements CrashSink {
  const ConsoleCrashSink();

  @override
  void log(String message) => developer.log(message, name: 'crash');

  @override
  void recordError(
    Object error,
    StackTrace stack, {
    String? reason,
    bool fatal = false,
  }) => developer.log(
    reason ?? 'error',
    name: 'crash',
    error: error,
    stackTrace: stack,
    level: fatal ? 1200 : 1000,
  );

  @override
  void setCustomKey(String key, Object value) {}
}

/// Telemetry as ks_core intends on apps; console-only on the web.
Future<void> setUpTelemetry({required String appVersion}) async {
  if (kIsWeb) {
    crashSink = const ConsoleCrashSink();
    return;
  }
  await Telemetry.install(appVersion: appVersion);
}
