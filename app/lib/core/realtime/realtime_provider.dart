import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/app_config.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

/// Builds the ks_core realtime client for the CommandVibe server.
RealtimeClient createRealtimeClient({
  required ApiClient api,
  NetworkMonitor? networkMonitor,
}) => RealtimeClient(
  uri: AppConfig.realtimeUri,
  tokenProvider: ({required forceRefresh}) =>
      api.accessToken(forceRefresh: forceRefresh),
  clientInfo: RealtimeClientInfo(
    app: 'commandvibe',
    build: 1,
    platform: kIsWeb ? 'web' : defaultTargetPlatform.name.toLowerCase(),
  ),
  networkMonitor: networkMonitor,
);
