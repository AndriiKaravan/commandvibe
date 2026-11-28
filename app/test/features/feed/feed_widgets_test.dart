import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/feed/data/feed_models.dart';
import 'package:commandvibe/features/feed/ui/feed_card.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/ui/blurred_photo_tile.dart';
import 'package:commandvibe/features/photos/ui/photo_pager.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

SubmissionItem _photo(String member, {required bool full, String? avatar}) =>
    SubmissionItem(
      memberId: member,
      displayName: member,
      avatar: avatar,
      submittedAt: DateTime.utc(2026, 12, 2),
      access: full ? PhotoAccess.full : PhotoAccess.blur,
      photoUrl: full ? Uri.parse('https://api.test/p/$member') : null,
      blurUrl: Uri.parse('https://api.test/p/$member-blur'),
      width: 800,
      height: 600,
      mine: false,
    );

FeedItem _item(String member, {required bool full}) => FeedItem(
  photo: _photo(member, full: full, avatar: 'av01'),
  dayIndex: 1,
  taskTitle: const TaskText(uk: 'Ялинка'),
  revealAt: DateTime.utc(2026, 12, 4, 7),
);

Widget _app(Widget child) => MaterialApp(
  locale: const Locale('uk'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  group('FeedCard', () {
    testWidgets('should show the author, the day and the task', (tester) async {
      await tester.pumpWidget(
        _app(
          FeedCard(
            item: _item('Олена', full: true),
            onOpen: () {},
            onImageFailed: () {},
          ),
        ),
      );

      expect(find.text('Олена'), findsOneWidget);
      expect(find.textContaining('Ялинка'), findsOneWidget);
      expect(find.textContaining('2'), findsWidgets);
    });

    testWidgets('should show a revealed photo and open it on tap', (
      tester,
    ) async {
      var opened = 0;
      await tester.pumpWidget(
        _app(
          FeedCard(
            item: _item('Олена', full: true),
            onOpen: () => opened++,
            onImageFailed: () {},
          ),
        ),
      );

      expect(find.byType(BlurredPhotoTile), findsNothing);
      await tester.tap(find.byKey(const Key('feed-photo')));

      expect(opened, 1);
    });

    testWidgets(
      'should show only the blurred tile with its invitation for a closed photo',
      (tester) async {
        var opened = 0;
        await tester.pumpWidget(
          _app(
            FeedCard(
              item: _item('Олена', full: false),
              onOpen: () => opened++,
              onImageFailed: () {},
            ),
          ),
        );

        expect(find.byType(BlurredPhotoTile), findsOneWidget);
        expect(find.text('Виконай завдання — і побач одразу'), findsOneWidget);
        expect(find.byKey(const Key('feed-photo')), findsNothing);
      },
    );

    testWidgets('should offer a like on a revealed photo of someone else', (
      tester,
    ) async {
      final asked = <bool>[];
      await tester.pumpWidget(
        _app(
          FeedCard(
            item: _item('Олена', full: true),
            onOpen: () {},
            onImageFailed: () {},
            onLike: (liked) async => asked.add(liked),
          ),
        ),
      );

      await tester.ensureVisible(find.byKey(const Key('like-button')));
      await tester.tap(find.byKey(const Key('like-button')));
      await tester.pump();

      expect(asked, [true]);
    });

    testWidgets('should not offer a like on a photo that is still blurred', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          FeedCard(
            item: _item('Олена', full: false),
            onOpen: () {},
            onImageFailed: () {},
            onLike: (liked) async {},
          ),
        ),
      );

      expect(find.byKey(const Key('like-button')), findsNothing);
    });

    testWidgets('should show only the count under my own photo', (
      tester,
    ) async {
      var asked = 0;
      final own = FeedItem(
        photo: SubmissionItem(
          memberId: 'me',
          displayName: 'Я',
          submittedAt: DateTime.utc(2026, 12, 2),
          access: PhotoAccess.full,
          photoUrl: Uri.parse('https://api.test/p/me'),
          blurUrl: Uri.parse('https://api.test/p/me-blur'),
          width: 800,
          height: 600,
          mine: true,
          likes: const LikeInfo(count: 2, mine: false, by: []),
        ),
        dayIndex: 1,
        taskTitle: const TaskText(uk: 'Ялинка'),
        revealAt: DateTime.utc(2026, 12, 4, 7),
      );
      await tester.pumpWidget(
        _app(
          FeedCard(
            item: own,
            onOpen: () {},
            onImageFailed: () {},
            onLike: (liked) async => asked++,
          ),
        ),
      );

      await tester.ensureVisible(find.byKey(const Key('like-button')));
      await tester.tap(
        find.byKey(const Key('like-button')),
        warnIfMissed: false,
      );
      await tester.pump();

      expect(asked, 0);
      expect(find.text('2'), findsOneWidget);
    });
  });

  group('PhotoPager', () {
    final items = [
      _photo('a', full: true),
      _photo('b', full: true),
      _photo('c', full: true),
    ];

    Future<List<String>> pump(WidgetTester tester, {String start = 'a'}) async {
      final seen = <String>[];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PhotoPager(
              items: items,
              initialMemberId: start,
              onPageChanged: (item) => seen.add(item.memberId),
              pageBuilder: (context, item) =>
                  Center(child: Text('photo ${item.memberId}')),
            ),
          ),
        ),
      );
      return seen;
    }

    testWidgets('should start on the opened photo', (tester) async {
      await pump(tester, start: 'b');

      expect(find.text('photo b'), findsOneWidget);
    });

    testWidgets('should swipe to the next photo of the day', (tester) async {
      final seen = await pump(tester);

      await tester.fling(find.byType(PageView), const Offset(-400, 0), 1000);
      await tester.pumpAndSettle();

      expect(find.text('photo b'), findsOneWidget);
      expect(seen, ['b']);
    });

    testWidgets('should not go past the first or last photo', (tester) async {
      await pump(tester);

      await tester.fling(find.byType(PageView), const Offset(400, 0), 1000);
      await tester.pumpAndSettle();

      expect(find.text('photo a'), findsOneWidget);
    });

    testWidgets(
      'should start on the first photo when the author is not in the list',
      (tester) async {
        await pump(tester, start: 'nobody');

        expect(find.text('photo a'), findsOneWidget);
      },
    );
  });
}
