import 'package:commandvibe/core/push/push_gateway.dart';
import 'package:commandvibe/core/push/push_gateway_testing.dart';
import 'package:commandvibe/features/notifications/data/notifications_models.dart';
import 'package:commandvibe/features/notifications/data/notifications_repository.dart';
import 'package:commandvibe/features/profile/notification_settings_card.dart';
import 'package:commandvibe/features/profile/notification_settings_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _Repository implements NotificationsRepository {
  _Repository({this.playing = true});

  final bool playing;
  bool? lastTasks;

  @override
  Future<NotificationSettings> loadSettings(String groupId) async =>
      NotificationSettings(tasks: true, social: true, playing: playing);

  @override
  Future<void> saveSettings(String groupId, {bool? tasks, bool? social}) async {
    lastTasks = tasks ?? lastTasks;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName}');
}

Future<NotificationSettingsViewModel> _pump(
  WidgetTester tester, {
  required _Repository repository,
  required FakePushService push,
}) async {
  final model = NotificationSettingsViewModel(
    repository,
    push,
    groupId: 'g1',
    syncToken: () async {},
  );
  await model.load();
  addTearDown(model.dispose);
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('uk'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: NotificationSettingsCard(model: model)),
    ),
  );
  return model;
}

void main() {
  group('NotificationSettingsCard', () {
    testWidgets('should offer to turn push on and then show it on', (
      tester,
    ) async {
      final push = FakePushService();
      await _pump(tester, repository: _Repository(), push: push);

      await tester.tap(find.byKey(const Key('enable-push')));
      await tester.pump();

      expect(find.text('Пуші на цьому пристрої увімкнено'), findsOneWidget);
      expect(find.byKey(const Key('enable-push')), findsNothing);
    });

    testWidgets('should send a switch the person flips', (tester) async {
      final repository = _Repository();
      await _pump(tester, repository: repository, push: FakePushService());

      await tester.tap(find.byKey(const Key('notify-tasks')));
      await tester.pump();

      expect(repository.lastTasks, isFalse);
    });

    testWidgets(
      'should tell an iPhone browser user to add the game to the home screen',
      (tester) async {
        final push = FakePushService()
          ..supportValue = PushSupport.needsHomeScreen;
        await _pump(tester, repository: _Repository(), push: push);

        expect(find.textContaining('головний екран'), findsOneWidget);
        expect(find.byKey(const Key('enable-push')), findsNothing);
      },
    );

    testWidgets('should say how to unblock notifications', (tester) async {
      final push = FakePushService()..permissionValue = PushPermission.denied;
      await _pump(tester, repository: _Repository(), push: push);

      expect(find.textContaining('заблоковано'), findsOneWidget);
    });

    testWidgets('should show no switches to an organizer who does not play', (
      tester,
    ) async {
      await _pump(
        tester,
        repository: _Repository(playing: false),
        push: FakePushService(),
      );

      expect(find.byKey(const Key('notify-tasks')), findsNothing);
      expect(find.byKey(const Key('notify-social')), findsNothing);
      expect(find.byKey(const Key('enable-push')), findsOneWidget);
    });
  });
}
