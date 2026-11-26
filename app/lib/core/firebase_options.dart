import 'package:commandvibe/core/app_config.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Non-secret client config of the `commandvibe-ks` Firebase project, per platform.
///
/// Kept in Dart (like flutterfire's generated file) so the native projects need no plist or gradle plugin.
FirebaseOptions firebaseOptionsFor(Uri page) {
  if (kIsWeb) {
    return AppConfig.webFirebaseOptions(page);
  }
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => const FirebaseOptions(
      apiKey: 'AIzaSyCqzMDl2qig7LqF7uqyRP4t3c9QyuXyOtk',
      appId: '1:889388170734:android:51dd309a185b0425cce2ff',
      messagingSenderId: '889388170734',
      projectId: 'commandvibe-ks',
      storageBucket: 'commandvibe-ks.firebasestorage.app',
    ),
    TargetPlatform.iOS => const FirebaseOptions(
      apiKey: 'AIzaSyBp9d7jgHVFaYshvb_QCG4bz60aAej54ZE',
      appId: '1:889388170734:ios:ac3e3fb442c20969cce2ff',
      messagingSenderId: '889388170734',
      projectId: 'commandvibe-ks',
      storageBucket: 'commandvibe-ks.firebasestorage.app',
      iosBundleId: 'dev.karavanstudio.commandvibe',
    ),
    _ => throw UnsupportedError('CommandVibe runs on web, Android and iOS'),
  };
}
