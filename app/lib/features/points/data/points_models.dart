import 'package:flutter/foundation.dart';

enum PointKind { done, speed, late, sympathy, goal, other }

PointKind _kindOf(Object? name) =>
    PointKind.values.asNameMap()[name] ?? PointKind.other;

@immutable
class PointEntry {
  const PointEntry({
    required this.dayIndex,
    required this.kind,
    required this.amount,
    this.detail,
  });

  factory PointEntry.fromJson(Map<String, dynamic> json) => PointEntry(
    dayIndex: json['dayIndex'] as int,
    kind: _kindOf(json['kind']),
    amount: json['amount'] as int,
    detail: json['detail'] as int?,
  );

  final int dayIndex;
  final PointKind kind;
  final int amount;

  /// Place for speed, days late for late, likes for sympathy.
  final int? detail;
}

@immutable
class PointsJournal {
  const PointsJournal({required this.total, required this.entries});

  factory PointsJournal.fromJson(Map<String, dynamic> json) => PointsJournal(
    total: json['total'] as int,
    entries: [
      for (final entry in json['entries'] as List<dynamic>)
        PointEntry.fromJson(entry as Map<String, dynamic>),
    ],
  );

  final int total;
  final List<PointEntry> entries;
}
