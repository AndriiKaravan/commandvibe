import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/push/push_gateway.dart';
import 'package:commandvibe/core/push/push_gateway_testing.dart';
import 'package:commandvibe/features/notifications/data/notifications_models.dart';
import 'package:commandvibe/features/notifications/data/notifications_repository.dart';
import 'package:commandvibe/features/profile/notification_settings_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

class _Repository implements NotificationsRepository {
  NotificationSettings settings = const NotificationSettings(
    tasks: true,
    social: true,
    playing: true,
  );
  Object? failOnSet;
  final sent = <Map<String, bool?>>[];

  @override
  Future<NotificationSettings> loadSettings(String groupId) async => settings;

  @override
  Future<void> saveSettings(String groupId, {bool? tasks, bool? social}) async {
    if (failOnSet != null) throw failOnSet!;
    sent.add({'tasks': tasks, 'social': social});
    settings = NotificationSettings(
      tasks: tasks ?? settings.tasks,
      social: social ?? settings.social,
      playing: settings.playing,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName}');
}

void main() {
  group('NotificationSettingsViewModel', () {
    late _Repository repository;
    late FakePushService push;
    late int synced;
    late NotificationSettingsViewModel model;

    Future<void> start() async {
      model = NotificationSettingsViewModel(
        repository,
        push,
        groupId: 'g1',
        syncToken: () async => synced++,
      );
      await model.load();
    }

    setUp(() {
      repository = _Repository();
      push = FakePushService();
      synced = 0;
    });

    tearDown(() => model.dispose());

    test('should be off until the person allows notifications', () async {
      await start();

      expect(model.pushState, PushState.off);
    });

    test('should be on when permission was already granted', () async {
      push.permissionValue = PushPermission.granted;
      await start();

      expect(model.pushState, PushState.on);
    });

    test('should explain each way push can be unavailable', () async {
      for (final (support, expected) in [
        (PushSupport.unsupportedPlatform, PushState.unsupported),
        (PushSupport.unsupportedBrowser, PushState.unsupported),
        (PushSupport.needsHomeScreen, PushState.needsHomeScreen),
        (PushSupport.notConfigured, PushState.notConfigured),
      ]) {
        push.supportValue = support;
        await start();
        expect(model.pushState, expected, reason: '$support');
        model.dispose();
      }
      await start();
    });

    test('should report a blocked permission', () async {
      push.permissionValue = PushPermission.denied;
      await start();

      expect(model.pushState, PushState.denied);
    });

    test(
      'should ask for permission and register the token when enabled',
      () async {
        await start();
        await model.enablePush();

        expect(model.pushState, PushState.on);
        expect(synced, 1);
      },
    );

    test(
      'should end up blocked, without a token, when the person refuses',
      () async {
        push.requestResult = PushPermission.denied;
        await start();
        await model.enablePush();

        expect(model.pushState, PushState.denied);
        expect(synced, 0);
      },
    );

    test('should show the saved switches', () async {
      repository.settings = const NotificationSettings(
        tasks: false,
        social: true,
        playing: true,
      );
      await start();

      expect(model.tasks, isFalse);
      expect(model.social, isTrue);
      expect(model.playing, isTrue);
    });

    test('should switch at once and send only that switch', () async {
      await start();
      final pending = model.setTasks(false);

      expect(model.tasks, isFalse);
      await pending;
      expect(repository.sent, [
        {'tasks': false, 'social': null},
      ]);
    });

    test('should roll a switch back when the server refuses', () async {
      await start();
      repository.failOnSet = NetworkException('offline');
      await model.setSocial(false);

      expect(model.social, isTrue);
      expect(model.failed, isTrue);
    });

    test(
      'should have no switches for an organizer who does not play',
      () async {
        repository.settings = const NotificationSettings(
          tasks: true,
          social: true,
          playing: false,
        );
        await start();

        expect(model.playing, isFalse);
      },
    );
  });
}
