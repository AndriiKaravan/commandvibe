import 'package:commandvibe/core/theme/app_theme.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/core/theme/glass_tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host(ThemeData theme) => MaterialApp(
  theme: theme,
  home: const Scaffold(body: GlassPanel(child: Text('hello'))),
);

void main() {
  group('GlassPanel', () {
    testWidgets('should blur the background when blur is enabled', (
      tester,
    ) async {
      await tester.pumpWidget(_host(AppTheme.dark()));
      expect(find.byType(BackdropFilter), findsOneWidget);
      expect(find.text('hello'), findsOneWidget);
    });

    testWidgets('should not build a BackdropFilter when blur is disabled', (
      tester,
    ) async {
      await tester.pumpWidget(_host(AppTheme.dark(blur: false)));
      expect(find.byType(BackdropFilter), findsNothing);
    });

    testWidgets(
      'should use an opaque fill without blur so text stays readable',
      (tester) async {
        await tester.pumpWidget(_host(AppTheme.light(blur: false)));
        final tokens = AppTheme.light(blur: false).extension<GlassTokens>()!;
        final box = tester.widget<DecoratedBox>(
          find
              .descendant(
                of: find.byType(GlassPanel),
                matching: find.byType(DecoratedBox),
              )
              .first,
        );
        final color = (box.decoration as BoxDecoration).color!;
        expect(color, tokens.solidFill);
        expect(color.a, greaterThan(0.9));
      },
    );
  });
}
