import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// The store package, the release key and the Apple team must agree across the
// native projects and the files Hosting serves, or link verification fails silently.
const _package = 'com.karavanstudio.commandvibe';
const _releaseSha256 =
    'D4:F1:A5:22:29:93:79:1E:F9:70:C7:EC:9D:1D:18:6E:E6:51:52:CC:80:6B:7E:7C:10:91:AB:1F:79:F0:CB:C2';
const _appleTeamId = '8RTTR2Y32B';
const _host = 'commandvibe.karavanstudio.dev';

String _read(String path) => File(path).readAsStringSync();

void main() {
  group('App Links and Universal Links config', () {
    test('should use the store package in Gradle and Xcode', () {
      final gradle = _read('android/app/build.gradle.kts');
      expect(gradle, contains('applicationId = "$_package"'));
      expect(gradle, contains('namespace = "$_package"'));
      final pbxproj = _read('ios/Runner.xcodeproj/project.pbxproj');
      final bundleIds = RegExp(
        r'PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);',
      ).allMatches(pbxproj).map((match) => match.group(1)!).toSet();
      expect(bundleIds, {_package, '$_package.RunnerTests'});
      expect(
        File(
          'android/app/src/main/kotlin/com/karavanstudio/commandvibe/MainActivity.kt',
        ).existsSync(),
        isTrue,
      );
    });

    test('should verify invite links on Android', () {
      final manifest = _read('android/app/src/main/AndroidManifest.xml');
      expect(manifest, contains('android:autoVerify="true"'));
      expect(manifest, contains('android:host="$_host"'));
      expect(manifest, contains('android:pathPrefix="/j/"'));
      final statements =
          jsonDecode(_read('web/.well-known/assetlinks.json')) as List<dynamic>;
      final target =
          (statements.single as Map<String, dynamic>)['target']
              as Map<String, dynamic>;
      expect(target['package_name'], _package);
      expect(target['sha256_cert_fingerprints'], [_releaseSha256]);
    });

    test('should verify invite links on iOS', () {
      expect(
        _read('ios/Runner/Runner.entitlements'),
        contains('applinks:$_host'),
      );
      expect(
        _read('ios/Runner.xcodeproj/project.pbxproj'),
        contains('CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;'),
      );
      final site =
          jsonDecode(_read('web/.well-known/apple-app-site-association'))
              as Map<String, dynamic>;
      final detail =
          ((site['applinks'] as Map<String, dynamic>)['details']
                      as List<dynamic>)
                  .single
              as Map<String, dynamic>;
      expect(detail['appIDs'], ['$_appleTeamId.$_package']);
      expect(
        (detail['components'] as List<dynamic>).map(
          (component) => (component as Map<String, dynamic>)['/'],
        ),
        ['/j/*'],
      );
    });

    test('should let Hosting serve .well-known as JSON', () {
      final hosting =
          (jsonDecode(_read('../firebase.json'))
                  as Map<String, dynamic>)['hosting']
              as Map<String, dynamic>;
      expect((hosting['ignore'] as List<dynamic>).contains('**/.*'), isFalse);
      final headers = hosting['headers'] as List<dynamic>;
      expect(
        headers.any(
          (rule) =>
              (rule as Map<String, dynamic>)['source'] ==
                  '/.well-known/apple-app-site-association' &&
              jsonEncode(rule['headers']).contains('application/json'),
        ),
        isTrue,
      );
    });
  });
}
