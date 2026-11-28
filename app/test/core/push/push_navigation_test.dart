import 'package:commandvibe/core/push/push_gateway.dart';
import 'package:commandvibe/core/push/push_gateway_testing.dart';
import 'package:commandvibe/core/push/push_navigation.dart';
import 'package:flutter_test/flutter_test.dart';

NotificationOpened _opened(Map<String, String> data, {bool cold = false}) =>
    NotificationOpened(
      source: NotificationSource.push,
      coldStart: cold,
      data: data,
    );

void main() {
  group('routeFromPush', () {
    test('should accept an in-app route of a group', () {
      expect(routeFromPush({'route': '/g/abc123/feed'}), '/g/abc123/feed');
      expect(routeFromPush({'route': '/g/abc123/today'}), '/g/abc123/today');
    });

    test('should refuse anything that is not a known page of a group', () {
      for (final route in [
        'https://evil.test/g/a/feed',
        '//evil.test/g/a/feed',
        '/g/a/../../org/groups',
        '/org/groups',
        '/g/a/feed?x=1',
        '/g/a/unknown',
        '',
      ]) {
        expect(routeFromPush({'route': route}), isNull, reason: route);
      }
      expect(routeFromPush({}), isNull);
    });

    test('should refuse a group other than the signed-in member’s', () {
      expect(
        routeFromPush({'route': '/g/other/feed'}, memberGroupId: 'mine'),
        isNull,
      );
      expect(
        routeFromPush({'route': '/g/mine/feed'}, memberGroupId: 'mine'),
        '/g/mine/feed',
      );
    });
  });

  group('PushNavigation', () {
    late FakePushService service;
    late List<String> went;
    late String? memberGroup;
    late bool signedIn;
    late PushNavigation navigation;

    setUp(() {
      service = FakePushService();
      went = [];
      memberGroup = null;
      signedIn = true;
      navigation = PushNavigation(
        service.opened,
        go: went.add,
        session: () async => signedIn ? (memberGroupId: memberGroup) : null,
      );
    });

    tearDown(() => navigation.dispose());

    test(
      'should open the route of a tapped push, also from a cold start',
      () async {
        service.emitOpened(_opened({'route': '/g/a1/feed'}, cold: true));
        service.emitOpened(_opened({'route': '/g/a1/today'}));
        await pumpEventQueue();

        expect(went, ['/g/a1/feed', '/g/a1/today']);
      },
    );

    test('should ignore a push without a usable route', () async {
      service.emitOpened(_opened({'route': 'https://evil.test/'}));
      service.emitOpened(_opened({}));
      await pumpEventQueue();

      expect(went, isEmpty);
    });

    test('should ignore a push when nobody is signed in', () async {
      signedIn = false;
      service.emitOpened(_opened({'route': '/g/a1/feed'}));
      await pumpEventQueue();

      expect(went, isEmpty);
    });

    test('should ignore another group’s push for a member', () async {
      memberGroup = 'mine';
      service.emitOpened(_opened({'route': '/g/other/feed'}));
      await pumpEventQueue();

      expect(went, isEmpty);
    });
  });
}
