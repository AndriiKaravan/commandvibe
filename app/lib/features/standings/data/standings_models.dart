import 'package:flutter/foundation.dart';

@immutable
class StandingItem {
  const StandingItem({
    required this.memberId,
    required this.displayName,
    required this.points,
    required this.rank,
    required this.mine,
    this.avatar,
    this.fans = 0,
  });

  factory StandingItem.fromJson(Map<String, dynamic> json) => StandingItem(
    memberId: json['memberId'] as String,
    displayName: json['displayName'] as String,
    avatar: json['avatar'] as String?,
    points: json['points'] as int,
    rank: json['rank'] as int,
    mine: json['mine'] as bool,
    fans: json['fans'] as int? ?? 0,
  );

  final String memberId;
  final String displayName;
  final String? avatar;
  final int points;
  final int rank;
  final bool mine;

  /// Different players who liked a photo of this member.
  final int fans;
}

@immutable
class MyPlace {
  const MyPlace({required this.rank, required this.points, this.toNext});

  factory MyPlace.fromJson(Map<String, dynamic> json) => MyPlace(
    rank: json['rank'] as int,
    points: json['points'] as int,
    toNext: json['toNext'] as int?,
  );

  final int rank;
  final int points;

  /// Points to the place just above; null for the leader.
  final int? toNext;
}

@immutable
class Standings {
  const Standings({required this.items, required this.me});

  factory Standings.fromJson(Map<String, dynamic> json) => Standings(
    items: [
      for (final item in json['items'] as List<dynamic>)
        StandingItem.fromJson(item as Map<String, dynamic>),
    ],
    me: json['me'] == null
        ? null
        : MyPlace.fromJson(json['me'] as Map<String, dynamic>),
  );

  final List<StandingItem> items;

  /// Absent for an organizer who does not play.
  final MyPlace? me;

  List<StandingItem> leaders(int count) => items.take(count).toList();

  /// Place of the player just above the viewer; null for the leader and for non-players.
  int? get nextRank {
    final own = me;
    if (own == null) {
      return null;
    }
    final above = items.where((item) => item.points > own.points);
    return above.isEmpty ? null : above.last.rank;
  }
}
