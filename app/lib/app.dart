import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/app_config.dart';
import 'package:commandvibe/core/platform/invite_link_source.dart';
import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:commandvibe/core/realtime/realtime_provider.dart';
import 'package:commandvibe/core/theme/app_theme.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:flutter/material.dart';
import 'package:ks_core/ks_core.dart';

/// App-wide services, wired once by hand (constructor injection, no DI framework).
class AppServices {
  AppServices._({
    required this.sessions,
    required this.api,
    required this.realtime,
    required this.inviteLinks,
    required this.photos,
  });

  factory AppServices.platform() {
    final sessions = SessionStore.platform();
    late final RealtimeClient realtime;
    final api = ApiClient(
      baseUri: AppConfig.apiUri,
      sessionStore: sessions,
      realtimeSessionId: () => realtime.sessionId,
    );
    realtime = createRealtimeClient(api: api);
    return AppServices._(
      sessions: sessions,
      api: api,
      realtime: realtime,
      inviteLinks: InviteLinkSource.platform(),
      photos: PhotoSource.platform(),
    );
  }

  final SessionStore sessions;
  final ApiClient api;
  final RealtimeClient realtime;
  final InviteLinkSource inviteLinks;
  final PhotoSource photos;
}

class CommandVibeApp extends StatelessWidget {
  const CommandVibeApp({super.key, required this.services});

  static Future<CommandVibeApp> create() async =>
      CommandVibeApp(services: AppServices.platform());

  final AppServices services;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CommandVibe',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      builder: (context, child) =>
          GlassBackground(child: child ?? const SizedBox.shrink()),
      home: const Scaffold(
        body: Center(child: GlassPanel(child: Text('CommandVibe'))),
      ),
    );
  }
}
