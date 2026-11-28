import 'package:flutter/foundation.dart';

/// Share of the group whose photos make the day a success (design 9, "spilna tsil").
const progressGoalShare = 0.8;

@immutable
class DayProgress {
  const DayProgress({
    required this.dayIndex,
    required this.done,
    required this.total,
    required this.mine,
  });

  factory DayProgress.fromJson(Map<String, dynamic> json) => DayProgress(
    dayIndex: json['dayIndex'] as int,
    done: json['done'] as int,
    total: json['total'] as int,
    mine: json['mine'] as bool?,
  );

  final int dayIndex;
  final int done;
  final int total;

  /// Whether the viewer has a photo that day; null when the viewer does not play.
  final bool? mine;

  double get share => total == 0 ? 0 : done / total;
  bool get goalReached => total > 0 && share >= progressGoalShare;
}

@immutable
class GameProgress {
  const GameProgress({
    required this.days,
    required this.currentDay,
    required this.serverTime,
  });

  factory GameProgress.fromJson(Map<String, dynamic> json) => GameProgress(
    days: [
      for (final day in json['days'] as List<dynamic>)
        DayProgress.fromJson(day as Map<String, dynamic>),
    ],
    currentDay: json['currentDay'] as int?,
    serverTime: DateTime.parse(json['serverTime'] as String),
  );

  final List<DayProgress> days;
  final int? currentDay;
  final DateTime serverTime;

  DayProgress? dayOf(int dayIndex) {
    for (final day in days) {
      if (day.dayIndex == dayIndex) {
        return day;
      }
    }
    return null;
  }

  DayProgress? get current => currentDay == null ? null : dayOf(currentDay!);
}
