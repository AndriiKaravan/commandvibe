import 'package:commandvibe/features/avatars/avatar_catalog.dart';
import 'package:commandvibe/features/avatars/avatar_picker_sheet.dart';
import 'package:commandvibe/features/avatars/avatar_picker_view_model.dart';
import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  sheetTests();

  group('initialsOf', () {
    test('should take the first letter of a single name', () {
      expect(initialsOf('Олена'), 'О');
    });

    test('should take the first letters of the first two words', () {
      expect(initialsOf('Олена Коваль Мирона'), 'ОК');
    });

    test('should ignore extra spaces and upper-case the letters', () {
      expect(initialsOf('  taras   shevchenko '), 'TS');
    });

    test('should show a placeholder for an empty name', () {
      expect(initialsOf('   '), '?');
    });
  });

  group('AvatarCatalog', () {
    test('should offer 24 unique ids with a picture each', () {
      expect(AvatarCatalog.ids, hasLength(24));
      expect(AvatarCatalog.ids.toSet(), hasLength(24));
      for (final id in AvatarCatalog.ids) {
        expect(AvatarCatalog.styleOf(id), isNotNull);
      }
    });

    test('should know nothing about an unknown id', () {
      expect(AvatarCatalog.styleOf('av99'), isNull);
      expect(AvatarCatalog.styleOf(null), isNull);
    });

    test('should give every avatar its own icon and colour pair', () {
      final pairs = AvatarCatalog.ids
          .map((id) => AvatarCatalog.styleOf(id)!)
          .map((style) => '${style.icon.codePoint}-${style.color.toARGB32()}');
      expect(pairs.toSet(), hasLength(24));
    });
  });

  group('MemberAvatar', () {
    Future<void> pump(WidgetTester tester, {String? avatar}) =>
        tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: MemberAvatar(displayName: 'Олена Коваль', avatar: avatar),
            ),
          ),
        );

    testWidgets('should show initials without an avatar', (tester) async {
      await pump(tester);

      expect(find.text('ОК'), findsOneWidget);
    });

    testWidgets(
      'should show initials for an avatar that is not in the collection',
      (tester) async {
        await pump(tester, avatar: 'av99');

        expect(find.text('ОК'), findsOneWidget);
      },
    );

    testWidgets(
      'should show the picture of a known avatar instead of initials',
      (tester) async {
        await pump(tester, avatar: 'av01');

        expect(find.text('ОК'), findsNothing);
        expect(
          find.byIcon(AvatarCatalog.styleOf('av01')!.icon),
          findsOneWidget,
        );
      },
    );
  });

  group('AvatarPickerViewModel', () {
    test('should save the picked id', () async {
      final saved = <String?>[];
      final viewModel = AvatarPickerViewModel(
        current: null,
        save: (id) async => saved.add(id),
      );

      await viewModel.pick('av03');

      expect(saved, ['av03']);
      expect(viewModel.current, 'av03');
    });

    test('should keep the old avatar when saving fails', () async {
      final viewModel = AvatarPickerViewModel(
        current: 'av01',
        save: (id) async => throw Exception('offline'),
      );

      await viewModel.pick('av02');

      expect(viewModel.current, 'av01');
      expect(viewModel.failed, isTrue);
    });

    test('should ignore a second tap while saving', () async {
      var calls = 0;
      final viewModel = AvatarPickerViewModel(
        current: null,
        save: (id) async {
          calls++;
          await Future<void>.delayed(const Duration(milliseconds: 10));
        },
      );

      final first = viewModel.pick('av01');
      final second = viewModel.pick('av02');
      await Future.wait([first, second]);

      expect(calls, 1);
    });

    test('should clear the avatar back to initials', () async {
      final saved = <String?>[];
      final viewModel = AvatarPickerViewModel(
        current: 'av04',
        save: (id) async => saved.add(id),
      );

      await viewModel.pick(null);

      expect(saved, [null]);
      expect(viewModel.current, isNull);
    });
  });
}

class _SheetHost extends StatelessWidget {
  const _SheetHost({required this.onPick});

  final Future<void> Function(String? id) onPick;

  @override
  Widget build(BuildContext context) => MaterialApp(
    locale: const Locale('uk'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: AvatarPickerSheet(
        displayName: 'Олена',
        current: 'av02',
        onPick: onPick,
      ),
    ),
  );
}

void sheetTests() {
  group('AvatarPickerSheet', () {
    testWidgets('should list the whole collection and send the tapped id', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final picked = <String?>[];
      await tester.pumpWidget(_SheetHost(onPick: (id) async => picked.add(id)));

      expect(find.byType(MemberAvatar), findsNWidgets(24));
      await tester.tap(find.byKey(const Key('avatar-av05')));
      await tester.pump();

      expect(picked, ['av05']);
    });

    testWidgets('should offer initials only', (tester) async {
      final picked = <String?>[];
      await tester.pumpWidget(_SheetHost(onPick: (id) async => picked.add(id)));

      await tester.tap(find.byKey(const Key('avatar-initials')));
      await tester.pump();

      expect(picked, [null]);
    });
  });
}
