import 'package:commandvibe/features/standings/data/standings_models.dart';

/// How places moved between two readings of the rating.
abstract final class RankTrend {
  /// Places gained (positive) or lost (negative) per member; unchanged places and newcomers are left out.
  static Map<String, int> between(
    List<StandingItem>? previous,
    List<StandingItem> next,
  ) {
    if (previous == null || previous.isEmpty || next.isEmpty) {
      return const {};
    }
    final before = {for (final item in previous) item.memberId: item.rank};
    final trend = <String, int>{};
    for (final item in next) {
      final was = before[item.memberId];
      if (was != null && was != item.rank) {
        trend[item.memberId] = was - item.rank;
      }
    }
    return trend;
  }
}
