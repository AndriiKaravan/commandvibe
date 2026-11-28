import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:commandvibe/features/standings/ui/my_place_card.dart';
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

Future<void> _pump(WidgetTester tester, Standings? standings) =>
    tester.pumpWidget(
      MaterialApp(
        locale: const Locale('uk'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: MyPlaceCard(standings: standings)),
      ),
    );

void main() {
  group('MyPlaceCard', () {
    testWidgets('should say the place and the gap to the next one up', (
      tester,
    ) async {
      await _pump(
        tester,
        Standings(
          items: [
            _item('Anna', 30, 1),
            _item('Boris', 20, 2),
            _item('Dmytro', 14, 3, mine: true),
          ],
          me: const MyPlace(rank: 3, points: 14, toNext: 6),
        ),
      );

      expect(find.text('Ти 3-й'), findsOneWidget);
      expect(find.textContaining('до 2-го — 6'), findsOneWidget);
      expect(find.text('Anna'), findsOneWidget);
      expect(find.text('Boris'), findsOneWidget);
    });

    testWidgets('should congratulate the leader instead of showing a gap', (
      tester,
    ) async {
      await _pump(
        tester,
        Standings(
          items: [_item('Anna', 30, 1, mine: true)],
          me: const MyPlace(rank: 1, points: 30),
        ),
      );

      expect(find.text('Ти 1-й'), findsOneWidget);
      expect(find.byKey(const Key('place-leader')), findsOneWidget);
    });

    testWidgets(
      'should show only the leaders to an organizer who does not play',
      (tester) async {
        await _pump(tester, Standings(items: [_item('Anna', 30, 1)], me: null));

        expect(find.textContaining('Ти '), findsNothing);
        expect(find.text('Anna'), findsOneWidget);
      },
    );

    testWidgets('should draw nothing when nobody has points to show yet', (
      tester,
    ) async {
      await _pump(tester, const Standings(items: [], me: null));
      expect(find.byType(Card), findsNothing);
      expect(find.byType(Text), findsNothing);

      await _pump(tester, null);
      expect(find.byType(Text), findsNothing);
    });
  });
}
