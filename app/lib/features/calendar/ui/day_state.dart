import 'package:commandvibe/features/calendar/data/calendar_models.dart';

/// What a door of the calendar shows the person looking at it.
enum DayCellState {
  closed,

  /// Open, and the viewer has no personal state: an organizer who does not play.
  open,
  canStillDo,
  doneOnTime,
  revealed,
}

/// Late completion stays possible after the reveal, so an undone day is always [DayCellState.canStillDo].
DayCellState dayCellState({
  required DayState state,
  required bool? mine,
  required DateTime now,
  required DateTime? revealAt,
}) {
  if (state != DayState.open) {
    return DayCellState.closed;
  }
  final revealed = revealAt != null && !now.isBefore(revealAt);
  return switch (mine) {
    null => revealed ? DayCellState.revealed : DayCellState.open,
    true => revealed ? DayCellState.revealed : DayCellState.doneOnTime,
    false => DayCellState.canStillDo,
  };
}
