import 'dart:math' as math;

import 'package:commandvibe/features/today/data/today_models.dart';

const _fullTurn = 2 * math.pi;

/// A late joiner sees this short replay instead of the whole spin (design 6a, "Today").
const replayDuration = Duration(milliseconds: 1500);

/// Where the wheel rests so that [winnerIndex] is under the pointer at the top.
///
/// Sector `i` is centred `i / doorCount` of a turn clockwise from the top.
double restAngle(int doorCount, int winnerIndex) =>
    (_fullTurn - _fullTurn * winnerIndex / doorCount) % _fullTurn;

/// The wheel's clockwise rotation [elapsed] into a spin of [duration]: fast first, then slowing to a stop.
double rouletteAngle({
  required Duration elapsed,
  required Duration duration,
  required int doorCount,
  required int winnerIndex,
  int turns = 5,
}) {
  final progress = (elapsed.inMicroseconds / duration.inMicroseconds).clamp(
    0.0,
    1.0,
  );
  final eased = 1 - math.pow(1 - progress, 3);
  final target = turns * _fullTurn + restAngle(doorCount, winnerIndex);
  return target * eased;
}

/// How one phone plays a [SpinInfo], given its estimate of the server clock.
///
/// Two phones with different clocks share the same wheel because both place "now" on the server's timeline.
class RouletteMotion {
  const RouletteMotion({
    required this.doorCount,
    required this.winnerIndex,
    required this.animationDuration,
    required this.startOffset,
    required this.delay,
    required this.replay,
  });

  factory RouletteMotion.from({
    required SpinInfo spin,
    required DateTime localNow,
    required Duration serverOffset,
  }) {
    final since = localNow.add(serverOffset).difference(spin.startAt);
    final common = (doors: spin.doors.length, winner: spin.winnerIndex);
    if (since >= spin.duration) {
      return RouletteMotion(
        doorCount: common.doors,
        winnerIndex: common.winner,
        animationDuration: replayDuration,
        startOffset: Duration.zero,
        delay: Duration.zero,
        replay: true,
      );
    }
    return RouletteMotion(
      doorCount: common.doors,
      winnerIndex: common.winner,
      animationDuration: spin.duration,
      startOffset: since.isNegative ? Duration.zero : since,
      delay: since.isNegative ? -since : Duration.zero,
      replay: false,
    );
  }

  final int doorCount;
  final int winnerIndex;

  /// Length of the whole animation (the spin's own, or the short replay).
  final Duration animationDuration;

  /// How far into the animation this phone starts.
  final Duration startOffset;

  /// How long to wait before starting, when the spin is still ahead.
  final Duration delay;
  final bool replay;

  Duration get remaining => animationDuration - startOffset;

  /// The wheel's angle [sinceBegin] after this phone began playing (not counting [delay]).
  double angleAt(Duration sinceBegin) => rouletteAngle(
    elapsed: startOffset + sinceBegin,
    duration: animationDuration,
    doorCount: doorCount,
    winnerIndex: winnerIndex,
  );
}
