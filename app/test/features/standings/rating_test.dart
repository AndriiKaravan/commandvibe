import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:commandvibe/features/standings/ui/rank_trend.dart';
import 'package:commandvibe/features/standings/ui/standings_list.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

StandingItem _item(String id, int points, int rank, {bool mine = false}) =>
    StandingItem(
      memberId: id,
      displayName: id,
      points: points,
      rank: rank,
      mine: mine,
    );

void main() {
  group('RankTrend', () {
    test('should show how many places a member climbed or fell', () {
      final trend = RankTrend.between(
        [_item('a', 30, 1), _item('b', 20, 2), _item('c', 10, 3)],
        [_item('c', 40, 1), _item('a', 30, 2), _item('b', 20, 3)],
      );

      expect(trend, {'c': 2, 'a': -1, 'b': -1});
    });

    test('should leave out members whose place did not change', () {
      final trend = RankTrend.between(
        [_item('a', 30, 1), _item('b', 20, 2)],
        [_item('a', 40, 1), _item('b', 20, 2)],
      );

      expect(trend, isEmpty);
    });

    test('should ignore a newcomer who has no earlier place', () {
      final trend = RankTrend.between(
        [_item('a', 30, 1)],
        [_item('a', 30, 1), _item('b', 0, 2)],
      );

      expect(trend, isEmpty);
    });

    test('should give nothing without an earlier list', () {
      expect(RankTrend.between(null, [_item('a', 1, 1)]), isEmpty);
      expect(RankTrend.between(const [], [_item('a', 1, 1)]), isEmpty);
      expect(RankTrend.between([_item('a', 1, 1)], const []), isEmpty);
    });

    test('should compare shared places by place, not by position', () {
      final trend = RankTrend.between(
        [_item('a', 20, 1), _item('b', 20, 1), _item('c', 0, 3)],
        [_item('a', 20, 1), _item('b', 20, 1), _item('c', 20, 1)],
      );

      expect(trend, {'c': 2});
    });
  });

  group('StandingsList', () {
    Future<void> pump(
      WidgetTester tester,
      List<StandingItem> items, {
      Map<String, int> trend = const {},
    }) => tester.pumpWidget(
      MaterialApp(
        locale: const Locale('uk'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: StandingsList(items: items, trend: trend),
          ),
        ),
      ),
    );

    testWidgets('should list everyone with place and points', (tester) async {
      await pump(tester, [_item('Anna', 30, 1), _item('Boris', 20, 2)]);

      expect(find.text('Anna'), findsOneWidget);
      expect(find.text('30 б.'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
    });

    testWidgets('should show the fans of a player and nothing for none', (
      tester,
    ) async {
      await pump(tester, [
        const StandingItem(
          memberId: 'a',
          displayName: 'Anna',
          points: 30,
          rank: 1,
          mine: false,
          fans: 5,
        ),
        _item('Boris', 20, 2),
      ]);

      expect(find.text('❤ 5'), findsOneWidget);
      expect(find.textContaining('❤'), findsOneWidget);
    });

    testWidgets('should mark the own row', (tester) async {
      await pump(tester, [
        _item('Anna', 30, 1),
        _item('Boris', 20, 2, mine: true),
      ]);

      expect(find.byKey(const Key('standing-Boris-mine')), findsOneWidget);
      expect(find.byKey(const Key('standing-Anna-mine')), findsNothing);
    });

    testWidgets('should show arrows for places gained and lost', (
      tester,
    ) async {
      await pump(
        tester,
        [_item('Anna', 30, 1), _item('Boris', 20, 2)],
        trend: {'Anna': 2, 'Boris': -1},
      );

      expect(find.text('↑2'), findsOneWidget);
      expect(find.text('↓1'), findsOneWidget);
    });

    testWidgets('should slide a row to its new place when the order changes', (
      tester,
    ) async {
      await pump(tester, [_item('Anna', 30, 1), _item('Boris', 20, 2)]);
      final before = tester
          .getTopLeft(find.byKey(const Key('standing-Boris')))
          .dy;
      expect(
        before,
        greaterThan(
          tester.getTopLeft(find.byKey(const Key('standing-Anna'))).dy,
        ),
      );

      await pump(tester, [_item('Boris', 40, 1), _item('Anna', 30, 2)]);
      await tester.pump(const Duration(milliseconds: 100));
      final midway = tester
          .getTopLeft(find.byKey(const Key('standing-Boris')))
          .dy;
      await tester.pumpAndSettle();
      final after = tester
          .getTopLeft(find.byKey(const Key('standing-Boris')))
          .dy;

      expect(midway, lessThan(before));
      expect(midway, greaterThan(after));
      expect(
        after,
        lessThan(tester.getTopLeft(find.byKey(const Key('standing-Anna'))).dy),
      );
    });

    testWidgets('should say there are no points yet', (tester) async {
      await pump(tester, const []);

      expect(find.text('Поки немає балів'), findsOneWidget);
    });
  });
}
