import 'package:commandvibe/features/profile/profile_card.dart';
import 'package:commandvibe/features/profile/profile_summary.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

StandingItem _item(
  String id,
  int points,
  int rank, {
  bool mine = false,
  String? avatar,
}) => StandingItem(
  memberId: id,
  displayName: id,
  points: points,
  rank: rank,
  mine: mine,
  avatar: avatar,
);

GameProgress _progress(List<bool?> mine, {int? currentDay}) => GameProgress(
  currentDay: currentDay,
  serverTime: DateTime.utc(2026, 12, 4),
  days: [
    for (var i = 0; i < mine.length; i++)
      DayProgress(dayIndex: i, done: 1, total: 2, mine: mine[i]),
  ],
);

void main() {
  group('ProfileSummary', () {
    test('should combine my place with the days I have done', () {
      final summary = ProfileSummary.from(
        standings: Standings(
          items: [
            _item('Anna', 30, 1),
            _item('Olena', 20, 2, mine: true, avatar: 'av03'),
          ],
          me: const MyPlace(rank: 2, points: 20, toNext: 10),
        ),
        progress: _progress([true, true, false, false], currentDay: 2),
      );

      expect(summary, isNotNull);
      expect(summary!.displayName, 'Olena');
      expect(summary.avatar, 'av03');
      expect(summary.points, 20);
      expect(summary.rank, 2);
      expect(summary.daysDone, 2);
      expect(summary.daysSoFar, 3);
    });

    test('should carry the number of fans', () {
      final summary = ProfileSummary.from(
        standings: Standings(
          items: [
            StandingItem(
              memberId: 'o',
              displayName: 'Olena',
              points: 0,
              rank: 1,
              mine: true,
              fans: 3,
            ),
          ],
          me: const MyPlace(rank: 1, points: 0),
        ),
        progress: null,
      );

      expect(summary!.fans, 3);
    });

    test('should be absent for someone who does not play', () {
      final summary = ProfileSummary.from(
        standings: Standings(items: [_item('Anna', 30, 1)], me: null),
        progress: _progress([true]),
      );

      expect(summary, isNull);
    });

    test('should be absent while the standings are not loaded', () {
      expect(ProfileSummary.from(standings: null, progress: null), isNull);
    });

    test(
      'should count no days before the first one opens, even without progress',
      () {
        final summary = ProfileSummary.from(
          standings: Standings(
            items: [_item('Olena', 0, 1, mine: true)],
            me: const MyPlace(rank: 1, points: 0),
          ),
          progress: null,
        );

        expect(summary!.daysDone, 0);
        expect(summary.daysSoFar, 0);
      },
    );

    test('should not count a day as done when the flag is unknown', () {
      final summary = ProfileSummary.from(
        standings: Standings(
          items: [_item('Olena', 0, 1, mine: true)],
          me: const MyPlace(rank: 1, points: 0),
        ),
        progress: _progress([null, false], currentDay: 1),
      );

      expect(summary!.daysDone, 0);
    });
  });

  group('ProfileCard', () {
    Future<void> pump(
      WidgetTester tester,
      ProfileSummary summary,
      VoidCallback onChangeAvatar,
    ) => tester.pumpWidget(
      MaterialApp(
        locale: const Locale('uk'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: ProfileCard(summary: summary, onChangeAvatar: onChangeAvatar),
        ),
      ),
    );

    const summary = ProfileSummary(
      displayName: 'Олена',
      avatar: null,
      points: 20,
      rank: 2,
      daysDone: 2,
      daysSoFar: 3,
      fans: 4,
    );

    testWidgets('should show the name, points, place and days done', (
      tester,
    ) async {
      await pump(tester, summary, () {});

      expect(find.text('Олена'), findsOneWidget);
      expect(find.text('20 б.'), findsOneWidget);
      expect(find.textContaining('2-й'), findsOneWidget);
      expect(find.textContaining('2 з 3'), findsOneWidget);
    });

    testWidgets('should show how many fans the player has', (tester) async {
      await pump(tester, summary, () {});

      expect(find.text('Прихильників: 4'), findsOneWidget);
    });

    testWidgets('should let the player change the avatar', (tester) async {
      var changed = 0;
      await pump(tester, summary, () => changed++);

      await tester.tap(find.byKey(const Key('change-avatar')));

      expect(changed, 1);
    });
  });
}
