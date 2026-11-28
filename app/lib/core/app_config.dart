import 'package:firebase_core/firebase_core.dart';

/// Build-time settings: `--dart-define=API=https://…`.
abstract final class AppConfig {
  static const apiBase = String.fromEnvironment(
    'API',
    defaultValue: 'http://localhost:3000',
  );

  static Uri get apiUri => Uri.parse(apiBase);

  /// Public Web Push key (Firebase → Cloud Messaging); empty keeps web push off.
  static const _vapid = String.fromEnvironment('VAPID_KEY');

  static String? get vapidKey => _vapid.isEmpty ? null : _vapid;

  /// Socket endpoint of the same server.
  static Uri get realtimeUri => apiUri.replace(
    scheme: apiUri.scheme == 'https' ? 'wss' : 'ws',
    path: '/ws',
  );

  /// Non-secret web config of the `commandvibe-ks` Firebase project.
  ///
  /// Sign-in runs through the page's own Hosting domain: browsers that block
  /// third-party storage break redirect sign-in when authDomain differs (day-1 spike).
  static FirebaseOptions webFirebaseOptions(Uri page) => FirebaseOptions(
    apiKey: 'AIzaSyDOmyJ7nQnR4c9uYRAFi24etu0yqWUteJs',
    appId: '1:889388170734:web:d0ee567d6dd598c4cce2ff',
    messagingSenderId: '889388170734',
    projectId: 'commandvibe-ks',
    authDomain: page.host == 'localhost'
        ? 'commandvibe-ks.firebaseapp.com'
        : page.host,
    storageBucket: 'commandvibe-ks.firebasestorage.app',
    measurementId: 'G-BM41X8YZP7',
  );
}
