import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/day_state.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The advent-calendar grid; closed doors do nothing when tapped.
class DoorsGrid extends StatelessWidget {
  const DoorsGrid({
    super.key,
    required this.days,
    required this.progress,
    required this.now,
    required this.onOpen,
  });

  final List<CalendarDay> days;
  final GameProgress? progress;
  final DateTime now;
  final void Function(CalendarDay day) onOpen;

  @override
  Widget build(BuildContext context) => GridView.count(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    crossAxisCount: 4,
    mainAxisSpacing: 10,
    crossAxisSpacing: 10,
    children: [
      for (final day in days)
        _Door(
          day: day,
          cell: dayCellState(
            state: day.state,
            mine: progress?.dayOf(day.dayIndex)?.mine,
            now: now,
            revealAt: day.revealAt,
          ),
          onOpen: onOpen,
        ),
    ],
  );
}

class _Door extends StatelessWidget {
  const _Door({required this.day, required this.cell, required this.onOpen});

  final CalendarDay day;
  final DayCellState cell;
  final void Function(CalendarDay day) onOpen;

  static IconData _icon(DayCellState cell) => switch (cell) {
    DayCellState.closed => Icons.lock,
    DayCellState.open => Icons.lock_open,
    DayCellState.canStillDo => Icons.add_a_photo,
    DayCellState.doneOnTime => Icons.check_circle,
    DayCellState.revealed => Icons.photo_library,
  };

  static String _label(AppLocalizations l10n, DayCellState cell) =>
      switch (cell) {
        DayCellState.closed => l10n.dayStateClosed,
        DayCellState.open => l10n.dayStateOpen,
        DayCellState.canStillDo => l10n.dayStateCanDo,
        DayCellState.doneOnTime => l10n.dayStateDone,
        DayCellState.revealed => l10n.dayStateRevealed,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final closed = cell == DayCellState.closed;
    return Semantics(
      button: !closed,
      label: '${l10n.daySheetTitle(day.dayIndex + 1)}, ${_label(l10n, cell)}',
      excludeSemantics: true,
      child: Material(
        key: Key('door-${day.dayIndex}'),
        color: closed
            ? scheme.surfaceContainerHighest
            : scheme.primaryContainer,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: closed ? null : () => onOpen(day),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${day.dayIndex + 1}',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 4),
              Icon(_icon(cell), size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
