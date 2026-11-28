import 'dart:async';

import 'package:commandvibe/features/likes/ui/like_button.dart';
import 'package:commandvibe/features/likes/ui/like_view_model.dart';
import 'package:commandvibe/features/likes/ui/likers_sheet.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/ui/photo_viewer_view.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child) => MaterialApp(
  locale: const Locale('uk'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: Center(child: child)),
);

void main() {
  group('LikeViewModel', () {
    test('should show the like at once and send it', () async {
      final sent = <bool>[];
      final gate = Completer<void>();
      final viewModel = LikeViewModel(
        initial: const LikeInfo(count: 2, mine: false),
        send: (liked) async {
          sent.add(liked);
          await gate.future;
        },
      );

      final pending = viewModel.toggle();
      expect(viewModel.info.mine, isTrue);
      expect(viewModel.info.count, 3);
      gate.complete();
      await pending;

      expect(sent, [true]);
      expect(viewModel.failed, isFalse);
    });

    test('should take a like back and never go below zero', () async {
      final viewModel = LikeViewModel(
        initial: const LikeInfo(count: 0, mine: true),
        send: (liked) async {},
      );

      await viewModel.toggle();

      expect(viewModel.info.mine, isFalse);
      expect(viewModel.info.count, 0);
    });

    test(
      'should roll back and flag the failure when the server refuses',
      () async {
        final viewModel = LikeViewModel(
          initial: const LikeInfo(count: 2, mine: false),
          send: (liked) async => throw Exception('offline'),
        );

        await viewModel.toggle();

        expect(viewModel.info.mine, isFalse);
        expect(viewModel.info.count, 2);
        expect(viewModel.failed, isTrue);
      },
    );

    test('should ignore a second tap while the first is on its way', () async {
      var calls = 0;
      final gate = Completer<void>();
      final viewModel = LikeViewModel(
        initial: const LikeInfo(count: 0, mine: false),
        send: (liked) async {
          calls++;
          await gate.future;
        },
      );

      final first = viewModel.toggle();
      final second = viewModel.toggle();
      gate.complete();
      await Future.wait([first, second]);

      expect(calls, 1);
      expect(viewModel.info.mine, isTrue);
    });

    test(
      'should follow fresh data from the server, but not in the middle of a tap',
      () async {
        final gate = Completer<void>();
        final viewModel = LikeViewModel(
          initial: const LikeInfo(count: 1, mine: false),
          send: (liked) => gate.future,
        );

        viewModel.sync(const LikeInfo(count: 5, mine: false));
        expect(viewModel.info.count, 5);

        final pending = viewModel.toggle();
        viewModel.sync(const LikeInfo(count: 9, mine: false));
        expect(viewModel.info.count, 6);
        gate.complete();
        await pending;
      },
    );
  });

  group('LikeButton', () {
    testWidgets('should show the count and ask to like when tapped', (
      tester,
    ) async {
      final asked = <bool>[];
      await tester.pumpWidget(
        _app(
          LikeButton(
            likes: const LikeInfo(count: 3, mine: false, by: []),
            enabled: true,
            onToggle: (liked) async => asked.add(liked),
          ),
        ),
      );

      expect(find.text('3'), findsOneWidget);
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      await tester.tap(find.byKey(const Key('like-button')));
      await tester.pump();

      expect(asked, [true]);
      expect(find.byIcon(Icons.favorite), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
    });

    testWidgets('should take the like back when it is already mine', (
      tester,
    ) async {
      final asked = <bool>[];
      await tester.pumpWidget(
        _app(
          LikeButton(
            likes: const LikeInfo(count: 1, mine: true, by: []),
            enabled: true,
            onToggle: (liked) async => asked.add(liked),
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('like-button')));
      await tester.pump();

      expect(asked, [false]);
    });

    testWidgets('should only show the count where liking is not allowed', (
      tester,
    ) async {
      var asked = 0;
      await tester.pumpWidget(
        _app(
          LikeButton(
            likes: const LikeInfo(count: 2, mine: false),
            enabled: false,
            onToggle: (liked) async => asked++,
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('like-button')));
      await tester.pump();

      expect(asked, 0);
      expect(find.text('2'), findsOneWidget);
    });

    testWidgets(
      'should open the list of names from the count, when names are shown',
      (tester) async {
        var shown = 0;
        await tester.pumpWidget(
          _app(
            LikeButton(
              likes: const LikeInfo(count: 2, mine: false, by: []),
              enabled: true,
              onToggle: (liked) async {},
              onShowLikers: () => shown++,
            ),
          ),
        );

        await tester.tap(find.byKey(const Key('like-count')));

        expect(shown, 1);
      },
    );

    testWidgets('should not offer the names when none are given', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          LikeButton(
            likes: const LikeInfo(count: 2, mine: false),
            enabled: true,
            onToggle: (liked) async {},
          ),
        ),
      );

      expect(find.byKey(const Key('like-count')), findsNothing);
      expect(find.text('2'), findsOneWidget);
    });
  });

  group('PhotoViewerBody likes', () {
    SubmissionItem photo({required bool full, bool mine = false}) =>
        SubmissionItem(
          memberId: 'm1',
          displayName: 'Олена',
          submittedAt: DateTime.utc(2026, 12, 2),
          access: full ? PhotoAccess.full : PhotoAccess.blur,
          photoUrl: full ? Uri.parse('https://api.test/p/photo') : null,
          blurUrl: Uri.parse('https://api.test/p/blur'),
          width: 800,
          height: 600,
          mine: mine,
          likes: const LikeInfo(count: 1, mine: false, by: []),
        );

    Future<void> pump(
      WidgetTester tester,
      SubmissionItem item,
      List<bool> asked,
    ) => tester.pumpWidget(
      _app(
        SizedBox(
          height: 900,
          child: PhotoViewerBody(
            item: item,
            onReport: (_) async {},
            onHide: (_) async {},
            onDismiss: () async {},
            onImageFailed: () {},
            onLike: (liked) async => asked.add(liked),
          ),
        ),
      ),
    );

    testWidgets('should let a viewer like a revealed photo of someone else', (
      tester,
    ) async {
      final asked = <bool>[];
      await pump(tester, photo(full: true), asked);

      await tester.ensureVisible(find.byKey(const Key('like-button')));
      await tester.tap(find.byKey(const Key('like-button')));
      await tester.pump();

      expect(asked, [true]);
    });

    testWidgets('should not offer a like on a photo seen blurred', (
      tester,
    ) async {
      await pump(tester, photo(full: false), []);

      expect(find.byKey(const Key('like-button')), findsNothing);
    });
  });

  group('LikersSheet', () {
    testWidgets('should list who liked the photo', (tester) async {
      await tester.pumpWidget(
        _app(
          const LikersSheet(
            likers: [
              Liker(memberId: 'a', displayName: 'Анна', avatar: 'av01'),
              Liker(memberId: 'b', displayName: 'Борис'),
            ],
          ),
        ),
      );

      expect(find.text('Вподобали'), findsOneWidget);
      expect(find.text('Анна'), findsOneWidget);
      expect(find.text('Борис'), findsOneWidget);
    });
  });
}
