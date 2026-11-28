import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:flutter/foundation.dart';

/// The viewer's own line of the game: who they are, how they stand, how many days they have done.
@immutable
class ProfileSummary {
  const ProfileSummary({
    required this.displayName,
    required this.avatar,
    required this.points,
    required this.rank,
    required this.daysDone,
    required this.daysSoFar,
  });

  /// Null for someone who does not play (an organizer watching) or before the standings arrive.
  static ProfileSummary? from({
    required Standings? standings,
    required GameProgress? progress,
  }) {
    final me = standings?.me;
    if (standings == null || me == null) {
      return null;
    }
    final own = standings.items.where((item) => item.mine).firstOrNull;
    if (own == null) {
      return null;
    }
    final current = progress?.currentDay;
    return ProfileSummary(
      displayName: own.displayName,
      avatar: own.avatar,
      points: me.points,
      rank: me.rank,
      daysDone: progress?.days.where((day) => day.mine == true).length ?? 0,
      daysSoFar: current == null ? 0 : current + 1,
    );
  }

  final String displayName;
  final String? avatar;
  final int points;
  final int rank;
  final int daysDone;

  /// Days opened so far, the number "done" is measured against.
  final int daysSoFar;
}
