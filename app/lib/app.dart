import 'dart:async';

import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/app_config.dart';
import 'package:commandvibe/core/platform/invite_link_source.dart';
import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/platform/organizer_sign_in.dart';
import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:commandvibe/core/realtime/realtime_provider.dart';
import 'package:commandvibe/core/router.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/app_theme.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:ks_core/ks_core.dart';

AppServices createPlatformServices() {
  final sessions = ObservedSessionStore(SessionStore.platform());
  late final RealtimeClient realtime;
  final api = ApiClient(
    baseUri: AppConfig.apiUri,
    sessionStore: sessions,
    realtimeSessionId: () => realtime.sessionId,
  );
  realtime = createRealtimeClient(api: api);
  return AppServices(
    sessions: sessions,
    api: api,
    realtime: realtime,
    inviteLinks: InviteLinkSource.platform(),
    photos: PhotoSource.platform(),
    organizerSignIn: OrganizerSignIn.platform(),
  );
}

class CommandVibeApp extends StatefulWidget {
  const CommandVibeApp({
    super.key,
    required this.services,
    required this.router,
  });

  static Future<CommandVibeApp> create() async {
    final services = createPlatformServices();
    final initial = await initialLocation(
      services.sessions,
      await services.inviteLinks.initialToken(),
    );
    services.realtime.start();
    return CommandVibeApp(
      services: services,
      router: createRouter(sessions: services.sessions, initial: initial),
    );
  }

  final AppServices services;
  final GoRouter router;

  @override
  State<CommandVibeApp> createState() => _CommandVibeAppState();
}

class _CommandVibeAppState extends State<CommandVibeApp> {
  StreamSubscription<String>? _links;

  @override
  void initState() {
    super.initState();
    // A link tapped while the app is open (App Links / Universal Links).
    _links = widget.services.inviteLinks.tokens.listen(
      (token) => widget.router.go(
        Uri(path: '/join', queryParameters: {'t': token}).toString(),
      ),
    );
  }

  @override
  void dispose() {
    _links?.cancel();
    widget.services.realtime.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ServicesScope(
      services: widget.services,
      child: MaterialApp.router(
        title: 'CommandVibe',
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        routerConfig: widget.router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        // Ukrainian first: the first groups are Ukrainian; English follows the device.
        localeResolutionCallback: (locale, supported) => supported.firstWhere(
          (s) => s.languageCode == locale?.languageCode,
          orElse: () => const Locale('uk'),
        ),
        builder: (context, child) =>
            GlassBackground(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
