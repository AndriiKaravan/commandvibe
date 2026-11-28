import 'package:commandvibe/features/comments/data/comments_models.dart';
import 'package:commandvibe/features/comments/ui/comments_section.dart';
import 'package:commandvibe/features/comments/ui/comments_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

CommentItem _comment(
  String id,
  String text, {
  bool canDelete = false,
  String name = 'Олена',
}) => CommentItem(
  id: id,
  memberId: 'm-$id',
  displayName: name,
  text: text,
  createdAt: DateTime.utc(2026, 12, 2, 8),
  mine: canDelete,
  canDelete: canDelete,
);

Widget _app(Widget child) => MaterialApp(
  locale: const Locale('uk'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  group('CommentsList', () {
    testWidgets('should say there are no comments yet', (tester) async {
      await tester.pumpWidget(
        _app(CommentsList(items: const [], onDelete: (_) {})),
      );

      expect(find.text('Поки без коментарів'), findsOneWidget);
    });

    testWidgets('should list who wrote what', (tester) async {
      await tester.pumpWidget(
        _app(
          CommentsList(
            items: [
              _comment('1', 'Гарно!', name: 'Анна'),
              _comment('2', 'Круто', name: 'Борис'),
            ],
            onDelete: (_) {},
          ),
        ),
      );

      expect(find.text('Анна'), findsOneWidget);
      expect(find.text('Гарно!'), findsOneWidget);
      expect(find.text('Борис'), findsOneWidget);
    });

    testWidgets('should offer delete only where the server allows it', (
      tester,
    ) async {
      final deleted = <String>[];
      await tester.pumpWidget(
        _app(
          CommentsList(
            items: [
              _comment('1', 'чуже'),
              _comment('2', 'моє', canDelete: true),
            ],
            onDelete: deleted.add,
          ),
        ),
      );

      expect(find.byKey(const Key('delete-comment-1')), findsNothing);
      await tester.tap(find.byKey(const Key('delete-comment-2')));

      expect(deleted, ['2']);
    });
  });

  group('CommentInput', () {
    testWidgets('should send what was typed and clear the field', (
      tester,
    ) async {
      final sent = <String>[];
      await tester.pumpWidget(
        _app(
          CommentInput(
            sending: false,
            error: null,
            onSend: (text) async => sent.add(text),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField), 'Привіт усім');
      await tester.tap(find.byKey(const Key('send-comment')));
      await tester.pump();

      expect(sent, ['Привіт усім']);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '',
      );
    });

    testWidgets('should not send while a send is on its way', (tester) async {
      final sent = <String>[];
      await tester.pumpWidget(
        _app(
          CommentInput(
            sending: true,
            error: null,
            onSend: (text) async => sent.add(text),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField), 'ще');
      await tester.tap(
        find.byKey(const Key('send-comment')),
        warnIfMissed: false,
      );
      await tester.pump();

      expect(sent, isEmpty);
    });

    testWidgets('should show the reason when a comment is refused', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          CommentInput(
            sending: false,
            error: CommentError.tooLong,
            onSend: (_) async {},
          ),
        ),
      );

      expect(find.text('Не більше 500 символів'), findsOneWidget);
    });
  });
}
