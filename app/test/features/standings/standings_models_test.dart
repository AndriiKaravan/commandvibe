import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Standings', () {
    test('should read items and the own place with the gap', () {
      final standings = Standings.fromJson({
        'serverTime': '2026-12-02T10:00:00.000Z',
        'items': [
          {
            'memberId': 'a',
            'displayName': 'Anna',
            'avatar': 'av01',
            'points': 30,
            'rank': 1,
            'mine': false,
          },
          {
            'memberId': 'b',
            'displayName': 'Boris',
            'points': 20,
            'rank': 2,
            'mine': true,
          },
        ],
        'me': {'rank': 2, 'points': 20, 'toNext': 10},
      });

      expect(standings.items.first.avatar, 'av01');
      expect(standings.items.last.avatar, isNull);
      expect(standings.me?.toNext, 10);
      expect(standings.leaders(2).map((i) => i.displayName), ['Anna', 'Boris']);
      expect(standings.leaders(1), hasLength(1));
    });

    test('should name the place of the player just above the viewer', () {
      final standings = Standings.fromJson({
        'serverTime': '2026-12-02T10:00:00.000Z',
        'items': [
          {
            'memberId': 'a',
            'displayName': 'Anna',
            'points': 30,
            'rank': 1,
            'mine': false,
          },
          {
            'memberId': 'b',
            'displayName': 'Boris',
            'points': 20,
            'rank': 2,
            'mine': false,
          },
          {
            'memberId': 'c',
            'displayName': 'Clara',
            'points': 20,
            'rank': 2,
            'mine': false,
          },
          {
            'memberId': 'd',
            'displayName': 'Dmytro',
            'points': 0,
            'rank': 4,
            'mine': true,
          },
        ],
        'me': {'rank': 4, 'points': 0, 'toNext': 20},
      });

      expect(standings.nextRank, 2);
    });

    test('should have no next place for the leader', () {
      final standings = Standings.fromJson({
        'serverTime': '2026-12-02T10:00:00.000Z',
        'items': [
          {
            'memberId': 'a',
            'displayName': 'Anna',
            'points': 30,
            'rank': 1,
            'mine': true,
          },
        ],
        'me': {'rank': 1, 'points': 30},
      });

      expect(standings.nextRank, isNull);
    });

    test('should have no own place for an organizer who does not play', () {
      final standings = Standings.fromJson({
        'serverTime': '2026-12-02T10:00:00.000Z',
        'items': const [],
      });

      expect(standings.me, isNull);
      expect(standings.items, isEmpty);
    });
  });
}
