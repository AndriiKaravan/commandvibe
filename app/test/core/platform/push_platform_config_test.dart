import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String _read(String path) => File(path).readAsStringSync();

void main() {
  group('push platform configuration', () {
    test('iOS should declare the APNs environment', () {
      expect(
        _read('ios/Runner/Runner.entitlements'),
        contains('aps-environment'),
      );
    });

    test('iOS should keep the associated domain next to it', () {
      expect(
        _read('ios/Runner/Runner.entitlements'),
        contains('applinks:commandvibe.karavanstudio.dev'),
      );
    });

    test('iOS should allow remote-notification background delivery', () {
      final plist = _read('ios/Runner/Info.plist');
      expect(plist, contains('UIBackgroundModes'));
      expect(plist, contains('remote-notification'));
    });

    test('iOS should ask for an APNs token explicitly', () {
      expect(
        _read('ios/Runner/AppDelegate.swift'),
        contains('registerForRemoteNotifications'),
      );
    });

    test('Android should be allowed to post notifications', () {
      expect(
        _read('android/app/src/main/AndroidManifest.xml'),
        contains('android.permission.POST_NOTIFICATIONS'),
      );
    });

    test('web should ship the messaging service worker for this project', () {
      final worker = _read('web/firebase-messaging-sw.js');
      expect(worker, contains('importScripts'));
      expect(worker, contains('firebase-messaging-compat.js'));
      expect(worker, contains('889388170734'));
      expect(worker, contains('commandvibe-ks'));
    });
  });
}
