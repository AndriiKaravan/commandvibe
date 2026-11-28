import 'package:commandvibe/features/shell/group_shell.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<List<String>> _labels(
  WidgetTester tester, {
  required bool isOwner,
}) async {
  late List<String> labels;
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('uk'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) {
          labels = groupTabs(
            AppLocalizations.of(context),
            isOwner: isOwner,
          ).map((tab) => tab.label).toList();
          return const SizedBox.shrink();
        },
      ),
    ),
  );
  return labels;
}

void main() {
  group('groupTabs', () {
    testWidgets('should offer a member five tabs ending with "Me"', (
      tester,
    ) async {
      expect(await _labels(tester, isOwner: false), [
        'Сьогодні',
        'Календар',
        'Стрічка',
        'Рейтинг',
        'Я',
      ]);
    });

    testWidgets('should end the organizer tabs with "Group"', (tester) async {
      expect((await _labels(tester, isOwner: true)).last, 'Група');
    });
  });
}
