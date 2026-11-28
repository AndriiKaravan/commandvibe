import 'package:commandvibe/features/notifications/data/notifications_models.dart';
import 'package:commandvibe/features/notifications/ui/bell_button.dart';
import 'package:commandvibe/features/notifications/ui/notification_text.dart';
import 'package:commandvibe/features/notifications/ui/notifications_view.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

AppNotification _n(
  NotificationKind kind, {
  String id = 'n1',
  int? day,
  String? actor,
  int? count,
  bool read = false,
  DateTime? at,
}) => AppNotification(
  id: id,
  kind: kind,
  dayIndex: day,
  actorName: actor,
  count: count,
  createdAt: at ?? DateTime.utc(2026, 12, 2, 9),
  read: read,
);

Widget _app(Widget child, {Locale locale = const Locale('uk')}) => MaterialApp(
  locale: locale,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: child),
);

void main() {
  group('NotificationsPage', () {
    test(
      'should read items, unread count and unknown kinds from the server',
      () {
        final page = NotificationsPage.fromJson({
          'unread': 2,
          'items': [
            {
              'id': 'a',
              'kind': 'comment',
              'dayIndex': 1,
              'actorName': 'Ira',
              'createdAt': '2026-12-02T09:00:00.000Z',
              'read': false,
            },
            {
              'id': 'b',
              'kind': 'something_new',
              'createdAt': '2026-12-02T08:00:00.000Z',
              'read': true,
            },
          ],
        });

        expect(page.unread, 2);
        expect(page.items[0].kind, NotificationKind.comment);
        expect(page.items[0].actorName, 'Ira');
        expect(page.items[1].kind, NotificationKind.unknown);
      },
    );
  });

  group('notificationText', () {
    late AppLocalizations uk;
    late AppLocalizations en;

    setUpAll(() async {
      uk = await AppLocalizations.delegate.load(const Locale('uk'));
      en = await AppLocalizations.delegate.load(const Locale('en'));
    });

    test('should say something for every kind in both languages', () {
      for (final kind in NotificationKind.values) {
        final n = _n(kind, actor: 'Ira', count: 3);
        expect(notificationText(uk, n), isNotEmpty);
        expect(notificationText(en, n), isNotEmpty);
      }
    });

    test('should name the actor when known and stay generic otherwise', () {
      expect(
        notificationText(en, _n(NotificationKind.comment, actor: 'Ira')),
        'Ira commented on your photo',
      );
      expect(
        notificationText(en, _n(NotificationKind.comment)),
        'New comment on your photo',
      );
    });

    test('should show how many liked', () {
      expect(
        notificationText(en, _n(NotificationKind.likes, count: 3)),
        'Your photo was liked by 3',
      );
    });
  });

  group('notificationRoute', () {
    test('should lead each kind to the tab where it happened', () {
      String route(NotificationKind kind) => notificationRoute('g1', _n(kind));
      expect(route(NotificationKind.dayOpened), '/g/g1/today');
      expect(route(NotificationKind.myTurn), '/g/g1/today');
      expect(route(NotificationKind.reminder), '/g/g1/today');
      expect(route(NotificationKind.photosRevealed), '/g/g1/feed');
      expect(route(NotificationKind.likes), '/g/g1/feed');
      expect(route(NotificationKind.comment), '/g/g1/feed');
      expect(route(NotificationKind.pendingMember), '/g/g1/me');
      expect(route(NotificationKind.complaint), '/g/g1/complaints');
      expect(route(NotificationKind.unknown), '/g/g1/today');
    });
  });

  group('BellButton', () {
    Future<void> pumpBell(WidgetTester tester, int unread) => tester.pumpWidget(
      _app(
        Center(
          child: BellButton(unread: unread, onPressed: () {}),
        ),
      ),
    );

    testWidgets('should show no badge when nothing is unread', (tester) async {
      await pumpBell(tester, 0);

      expect(find.byType(Badge), findsOneWidget);
      expect(find.text('0'), findsNothing);
      expect(tester.widget<Badge>(find.byType(Badge)).isLabelVisible, isFalse);
    });

    testWidgets('should show the count and cap it at 99+', (tester) async {
      await pumpBell(tester, 3);
      expect(find.text('3'), findsOneWidget);
      await pumpBell(tester, 120);
      expect(find.text('99+'), findsOneWidget);
    });
  });

  group('NotificationsList', () {
    testWidgets('should tell when there is nothing yet', (tester) async {
      await tester.pumpWidget(
        _app(NotificationsList(items: const [], onOpen: (_) {})),
      );

      expect(find.text('Поки що тихо'), findsOneWidget);
    });

    testWidgets('should group by day and open the tapped entry', (
      tester,
    ) async {
      AppNotification? opened;
      await tester.pumpWidget(
        _app(
          NotificationsList(
            items: [
              _n(NotificationKind.comment, id: 'a', day: 1, actor: 'Ira'),
              _n(NotificationKind.dayOpened, id: 'b', day: 1, read: true),
              _n(NotificationKind.dayOpened, id: 'c', day: 0, read: true),
            ],
            onOpen: (n) => opened = n,
          ),
        ),
      );

      expect(find.text('День 2'), findsOneWidget);
      expect(find.text('День 1'), findsOneWidget);
      await tester.tap(find.text('Ira прокоментував(-ла) твоє фото'));
      expect(opened?.id, 'a');
    });

    testWidgets('should make unread entries look different from read ones', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          NotificationsList(
            items: [
              _n(NotificationKind.reminder, id: 'u'),
              _n(NotificationKind.myTurn, id: 'r', read: true),
            ],
            onOpen: (_) {},
          ),
        ),
      );

      final unread = tester.widget<Text>(
        find.text('Сьогодні ще чекає завдання'),
      );
      final read = tester.widget<Text>(
        find.text('Твоя черга обирати завдання'),
      );
      expect(unread.style?.fontWeight, FontWeight.w700);
      expect(read.style?.fontWeight, isNot(FontWeight.w700));
    });
  });
}
