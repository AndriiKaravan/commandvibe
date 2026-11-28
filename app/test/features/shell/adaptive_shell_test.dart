import 'package:commandvibe/core/ui/adaptive_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _tabs = [
  ShellTab(label: 'One', icon: Icons.looks_one),
  ShellTab(label: 'Two', icon: Icons.looks_two),
];

Future<void> _pump(
  WidgetTester tester, {
  required Size size,
  int index = 0,
  ValueChanged<int>? onSelected,
  Set<int> badges = const {},
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: AdaptiveShell(
        currentIndex: index,
        onSelected: onSelected ?? (_) {},
        tabs: _tabs,
        badges: badges,
        child: const Text('body'),
      ),
    ),
  );
}

void main() {
  group('AdaptiveShell', () {
    testWidgets('should use a bottom bar on a phone', (tester) async {
      await _pump(tester, size: const Size(400, 800));

      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
      expect(find.text('body'), findsOneWidget);
    });

    testWidgets('should use a side rail on a wide screen', (tester) async {
      await _pump(tester, size: const Size(1200, 800));

      expect(find.byType(NavigationRail), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
    });

    testWidgets('should report the tapped tab', (tester) async {
      int? picked;
      await _pump(
        tester,
        size: const Size(400, 800),
        onSelected: (index) => picked = index,
      );

      await tester.tap(find.text('Two'));

      expect(picked, 1);
    });

    testWidgets('should dot only the tabs that have news', (tester) async {
      await _pump(tester, size: const Size(400, 800), badges: {1});

      final dots = tester.widgetList<Badge>(find.byType(Badge)).toList();
      expect(dots.map((b) => b.isLabelVisible), [false, true]);
    });

    testWidgets('should dot a tab on the wide rail too', (tester) async {
      await _pump(tester, size: const Size(1200, 800), badges: {0});

      final dots = tester.widgetList<Badge>(find.byType(Badge)).toList();
      expect(dots.map((b) => b.isLabelVisible), [true, false]);
    });
  });
}
