import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/ui/blurred_photo_tile.dart';
import 'package:commandvibe/features/photos/ui/day_photos_section.dart';
import 'package:commandvibe/features/photos/ui/photo_viewer_view.dart';
import 'package:commandvibe/features/photos/ui/submit_sheet.dart';
import 'package:commandvibe/features/photos/ui/submit_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_photos_repository.dart';

Widget app(
  Widget child, {
  Locale locale = const Locale('uk'),
  bool scrolls = true,
}) => MaterialApp(
  locale: locale,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: scrolls ? SingleChildScrollView(child: child) : child),
);

void main() {
  group('BlurredPhotoTile', () {
    testWidgets('should invite to do the task and say when the photo opens', (
      tester,
    ) async {
      await tester.pumpWidget(
        app(
          BlurredPhotoTile(
            blurUrl: Uri.parse('https://api.test/p/blur'),
            // A local time, so the text does not depend on the machine's zone.
            revealAt: DateTime(2026, 12, 3, 9),
            onImageFailed: () {},
          ),
        ),
      );
      expect(find.text('Виконай завдання — і побач одразу'), findsOneWidget);
      expect(find.text('або відкриється 3 грудня о 9:00'), findsOneWidget);
    });
  });

  group('DayPhotosSection', () {
    Future<void> show(WidgetTester tester, DaySubmissions day) async {
      await tester.pumpWidget(
        app(
          DayPhotosSection(
            day: day,
            loadFailed: false,
            onSubmit: () {},
            onOpen: (_) {},
            onImageFailed: () {},
          ),
        ),
      );
    }

    testWidgets(
      'should offer to submit only when allowed and nothing is sent',
      (tester) async {
        await show(tester, aDay(canSubmit: true));
        expect(find.text('Виконати'), findsOneWidget);
        expect(find.text('Виконано ✓'), findsNothing);
      },
    );

    testWidgets('should show done and replace before the reveal', (
      tester,
    ) async {
      await show(
        tester,
        aDay(canSubmit: false, mine: aSubmission(mine: true, version: 'v1')),
      );
      expect(find.text('Виконати'), findsNothing);
      expect(find.text('Виконано ✓'), findsOneWidget);
      expect(find.text('Замінити фото'), findsOneWidget);
    });

    testWidgets('should not offer a replacement after the reveal', (
      tester,
    ) async {
      await show(
        tester,
        aDay(
          canSubmit: false,
          revealed: true,
          mine: aSubmission(mine: true, version: 'v1'),
        ),
      );
      expect(find.text('Замінити фото'), findsNothing);
    });

    testWidgets('should blur the photos of others until the person submitted', (
      tester,
    ) async {
      await show(tester, aDay(items: [aSubmission(access: PhotoAccess.blur)]));
      expect(find.text('Виконай завдання — і побач одразу'), findsOneWidget);
    });

    testWidgets('should remind that late submissions are still possible', (
      tester,
    ) async {
      await show(
        tester,
        aDay(canSubmit: true, revealed: true, items: [aSubmission()]),
      );
      expect(
        find.text('Ще можна виконати — до кінця челенджу'),
        findsOneWidget,
      );
    });
  });

  group('PhotoViewerBody', () {
    Future<void> show(WidgetTester tester, SubmissionItem item) async {
      await tester.pumpWidget(
        app(
          PhotoViewerBody(
            item: item,
            onReport: (_) async {},
            onHide: (_) async {},
            onDismiss: () async {},
            onImageFailed: () {},
          ),
          scrolls: false,
        ),
      );
    }

    testWidgets('should show the organizer the earlier-taken mark', (
      tester,
    ) async {
      await show(
        tester,
        aSubmission(
          moderation: const Moderation(
            takenBefore: true,
            source: 'gallery',
            openComplaints: 0,
          ),
        ),
      );
      expect(find.text('Знято раніше, ніж відкрито завдання'), findsOneWidget);
      expect(find.text('Галерея (підказка)'), findsOneWidget);
      expect(find.text('Приховати'), findsOneWidget);
      expect(find.text('Поскаржитись'), findsNothing);
    });

    testWidgets('should show a member only the way to report', (tester) async {
      await show(tester, aSubmission());
      expect(find.text('Знято раніше, ніж відкрито завдання'), findsNothing);
      expect(find.text('Приховати'), findsNothing);
      expect(find.text('Поскаржитись'), findsOneWidget);
    });

    testWidgets('should not offer to report your own photo', (tester) async {
      await show(tester, aSubmission(mine: true, version: 'v1'));
      expect(find.text('Поскаржитись'), findsNothing);
    });
  });

  group('SubmitSheetBody', () {
    testWidgets('should show the exact too-large message', (tester) async {
      final model = SubmitViewModel(
        FakePhotosRepository(),
        FakePhotoSource(aPicked(aJpeg(SubmitViewModel.maxUploadBytes + 1))),
        groupId: 'g1',
        dayIndex: 0,
      );
      addTearDown(model.dispose);
      await tester.pumpWidget(app(SubmitSheetBody(viewModel: model)));
      await tester.tap(find.text('Обрати з галереї'));
      await tester.pump();
      await tester.pump();
      expect(
        find.text('Фото завелике — зніми ще раз або обери менше'),
        findsOneWidget,
      );
    });

    testWidgets('should ask before replacing an existing photo', (
      tester,
    ) async {
      final repository = FakePhotosRepository()
        ..submitErrors = [
          ApiException(
            409,
            code: 'already_submitted',
            details: {'version': 'v1'},
          ),
        ];
      final model = SubmitViewModel(
        repository,
        FakePhotoSource(aPicked(aJpeg())),
        groupId: 'g1',
        dayIndex: 0,
      );
      addTearDown(model.dispose);
      await tester.pumpWidget(app(SubmitSheetBody(viewModel: model)));
      await tester.tap(find.text('Зняти'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Замінити фото? Попереднє зникне'), findsOneWidget);
    });
  });
}
