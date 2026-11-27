import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:flutter/foundation.dart';

enum TodayStatus { notConfigured, beforeStart, active, finished }

TodayStatus _statusOf(Object? wire) => switch (wire) {
  'before_start' => TodayStatus.beforeStart,
  'active' => TodayStatus.active,
  'finished' => TodayStatus.finished,
  _ => TodayStatus.notConfigured,
};

/// One run of the roulette; every client animates it from [startAt] on the server's clock.
@immutable
class SpinInfo {
  const SpinInfo({
    required this.startAt,
    required this.duration,
    required this.doors,
    required this.winnerIndex,
    required this.by,
  });

  factory SpinInfo.fromJson(Map<String, dynamic> json) => SpinInfo(
    startAt: DateTime.parse(json['startAt'] as String),
    duration: Duration(milliseconds: json['durationMs'] as int),
    doors: [for (final door in (json['doors'] as List<dynamic>)) door as int],
    winnerIndex: json['winnerIndex'] as int,
    by: json['by'] as String,
  );

  final DateTime startAt;
  final Duration duration;

  /// Day indexes around the wheel, in order; never task titles.
  final List<int> doors;
  final int winnerIndex;

  /// `member` or `game`.
  final String by;
}

@immutable
class TodayDay {
  const TodayDay({
    required this.day,
    this.pickerMemberId,
    this.pickDeadlineAt,
    this.isMyTurn,
    this.spin,
  });

  factory TodayDay.fromJson(Map<String, dynamic> json) => TodayDay(
    day: CalendarDay.fromJson(json),
    pickerMemberId: json['pickerMemberId'] as String?,
    pickDeadlineAt: json['pickDeadlineAt'] == null
        ? null
        : DateTime.parse(json['pickDeadlineAt'] as String),
    isMyTurn: json['isMyTurn'] as bool?,
    spin: json['spin'] == null
        ? null
        : SpinInfo.fromJson(json['spin'] as Map<String, dynamic>),
  );

  final CalendarDay day;
  final String? pickerMemberId;
  final DateTime? pickDeadlineAt;

  /// Present only while the roulette waits: whether the viewer has to spin.
  final bool? isMyTurn;
  final SpinInfo? spin;
}

@immutable
class Today {
  const Today({required this.status, this.day, required this.serverTime});

  factory Today.fromJson(Map<String, dynamic> json) => Today(
    status: _statusOf(json['status']),
    day: json['day'] == null
        ? null
        : TodayDay.fromJson(json['day'] as Map<String, dynamic>),
    serverTime: DateTime.parse(json['serverTime'] as String),
  );

  final TodayStatus status;
  final TodayDay? day;
  final DateTime serverTime;
}
