import 'package:commandvibe/features/points/data/points_models.dart';
import 'package:flutter/foundation.dart';

@immutable
class JournalDay {
  const JournalDay({required this.dayIndex, required this.entries});

  final int dayIndex;
  final List<PointEntry> entries;

  int get subtotal => entries.fold(0, (sum, entry) => sum + entry.amount);
}

/// The journal by day, days in order and each day's entries as the server listed them.
List<JournalDay> groupJournal(List<PointEntry> entries) {
  final byDay = <int, List<PointEntry>>{};
  for (final entry in entries) {
    byDay.putIfAbsent(entry.dayIndex, () => []).add(entry);
  }
  final days = byDay.keys.toList()..sort();
  return [
    for (final day in days) JournalDay(dayIndex: day, entries: byDay[day]!),
  ];
}
