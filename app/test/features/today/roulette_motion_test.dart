import 'dart:math' as math;

import 'package:commandvibe/features/today/data/today_models.dart';
import 'package:commandvibe/features/today/ui/roulette_motion.dart';
import 'package:flutter_test/flutter_test.dart';

const twoPi = 2 * math.pi;

SpinInfo aSpin({DateTime? startAt, int doors = 8, int winner = 2}) => SpinInfo(
  startAt: startAt ?? DateTime.utc(2026, 12, 1, 7, 0, 1, 500),
  duration: const Duration(seconds: 5),
  doors: [for (var i = 0; i < doors; i++) i],
  winnerIndex: winner,
  by: 'member',
);

void main() {
  group('rouletteAngle', () {
    double angle(int millis, {int doors = 8, int winner = 2}) => rouletteAngle(
      elapsed: Duration(milliseconds: millis),
      duration: const Duration(seconds: 5),
      doorCount: doors,
      winnerIndex: winner,
    );

    test('should start at rest and never go backwards', () {
      expect(angle(0), 0);
      expect(angle(-300), 0);
      var previous = 0.0;
      for (var ms = 0; ms <= 5000; ms += 250) {
        expect(angle(ms), greaterThanOrEqualTo(previous));
        previous = angle(ms);
      }
    });

    test('should slow down: the first second covers more than the last', () {
      expect(angle(1000) - angle(0), greaterThan(angle(5000) - angle(4000)));
    });

    test('should stop with the winning door under the pointer', () {
      for (final (doors, winner) in [(8, 2), (31, 30), (1, 0), (5, 0)]) {
        final end = angle(5000, doors: doors, winner: winner);
        expect(end, angle(9000, doors: doors, winner: winner));
        expect(
          end % twoPi,
          closeTo(restAngle(doors, winner) % twoPi, 1e-9),
          reason: '$doors doors, winner $winner',
        );
      }
      // Door 2 of 8 sits a quarter turn from the top, so the wheel ends a quarter short of a full turn.
      expect(restAngle(8, 2), closeTo(1.5 * math.pi, 1e-9));
    });

    test('should make several full turns before stopping', () {
      expect(angle(5000), greaterThan(4 * twoPi));
    });
  });

  group('RouletteMotion', () {
    test('should play a running spin from where the server clock is', () {
      final spin = aSpin();
      final motion = RouletteMotion.from(
        spin: spin,
        localNow: DateTime.utc(2026, 12, 1, 7, 0, 3, 500),
        serverOffset: Duration.zero,
      );
      expect(motion.replay, isFalse);
      expect(motion.delay, Duration.zero);
      expect(motion.startOffset, const Duration(seconds: 2));
      expect(motion.remaining, const Duration(seconds: 3));
    });

    test('should wait for a spin that has not started yet', () {
      final motion = RouletteMotion.from(
        spin: aSpin(),
        localNow: DateTime.utc(2026, 12, 1, 7, 0, 1),
        serverOffset: Duration.zero,
      );
      expect(motion.delay, const Duration(milliseconds: 500));
      expect(motion.startOffset, Duration.zero);
      expect(motion.remaining, const Duration(seconds: 5));
    });

    test('should replay a finished spin briefly for a late joiner', () {
      final motion = RouletteMotion.from(
        spin: aSpin(),
        localNow: DateTime.utc(2026, 12, 1, 7, 5),
        serverOffset: Duration.zero,
      );
      expect(motion.replay, isTrue);
      expect(motion.animationDuration, const Duration(milliseconds: 1500));
      expect(motion.startOffset, Duration.zero);
      expect(motion.remaining, const Duration(milliseconds: 1500));
    });

    test('should show two phones with different clocks the same wheel', () {
      final spin = aSpin();
      final serverNow = DateTime.utc(2026, 12, 1, 7, 0, 4);
      // One phone is 7 s fast, the other 3 s slow; each has measured its offset from the server.
      final fast = RouletteMotion.from(
        spin: spin,
        localNow: serverNow.add(const Duration(seconds: 7)),
        serverOffset: const Duration(seconds: -7),
      );
      final slow = RouletteMotion.from(
        spin: spin,
        localNow: serverNow.subtract(const Duration(seconds: 3)),
        serverOffset: const Duration(seconds: 3),
      );
      expect(fast.startOffset, slow.startOffset);
      expect(fast.remaining, slow.remaining);
      for (final ms in [0, 400, 1200, 2500]) {
        final since = Duration(milliseconds: ms);
        expect(fast.angleAt(since), slow.angleAt(since));
      }
    });

    test('should reach the same final angle whatever the start', () {
      final spin = aSpin();
      final early = RouletteMotion.from(
        spin: spin,
        localNow: DateTime.utc(2026, 12, 1, 7, 0, 2),
        serverOffset: Duration.zero,
      );
      final late = RouletteMotion.from(
        spin: spin,
        localNow: DateTime.utc(2026, 12, 1, 7, 0, 5),
        serverOffset: Duration.zero,
      );
      expect(
        early.angleAt(early.remaining) % twoPi,
        closeTo(late.angleAt(late.remaining) % twoPi, 1e-9),
      );
    });
  });
}
