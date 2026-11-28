import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/app_config.dart';
import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/push/push_gateway.dart';
import 'package:commandvibe/core/push/session_http_client.dart';
import 'package:commandvibe/core/push/session_identity.dart';
import 'package:http/http.dart' as http;

/// Push as the app sees it: the device service, plus keeping this device's
/// token on the server for whoever is signed in. Everything else in the app
/// goes through this class and [push_gateway.dart], never the library directly.
class AppPush {
  AppPush({
    required this.service,
    required http.Client client,
    required Uri endpoint,
    required ObservedSessionStore sessions,
    String? platform,
  }) : _sessions = sessions,
       _registrar = PushTokenRegistrar(
         push: service,
         client: client,
         endpoint: endpoint,
         platform: platform,
       );

  factory AppPush.platform({
    required ApiClient api,
    required ObservedSessionStore sessions,
  }) => AppPush(
    service: FirebasePushService(
      options: PushOptions(webVapidKey: AppConfig.vapidKey),
    ),
    client: SessionHttpClient(http.Client(), accessToken: api.accessToken),
    endpoint: api.baseUri.replace(path: '/me/push-token'),
    sessions: sessions,
  );

  final PushService service;
  final ObservedSessionStore _sessions;
  final PushTokenRegistrar _registrar;

  /// Registers the token for each account that signs in; call once.
  void start() => _registrar.bind(signedInAccounts(_sessions));

  /// Registers the current token now, after the person allowed notifications.
  Future<void> sync() => _registrar.sync();

  /// Removes this device's token while the session can still authorize it,
  /// then ends the session.
  Future<void> signOut() async {
    await _registrar.unregister();
    await _sessions.clear();
  }

  Future<void> dispose() => _registrar.dispose();
}
