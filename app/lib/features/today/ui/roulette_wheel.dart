import 'dart:math' as math;

import 'package:flutter/material.dart';

/// The roulette wheel: one sector per door, numbered by day; rotated by [angle] radians clockwise.
///
/// The pointer is not part of it, so the wheel can turn under a fixed marker.
class RouletteWheel extends StatelessWidget {
  const RouletteWheel({
    super.key,
    required this.doors,
    required this.angle,
    this.size = 240,
  });

  /// Day indexes in wheel order; shown as day numbers (index + 1).
  final List<int> doors;
  final double angle;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Semantics(
      label: '${doors.length}',
      child: SizedBox.square(
        dimension: size,
        child: Transform.rotate(
          angle: angle,
          child: CustomPaint(
            painter: _WheelPainter(
              doors: doors,
              primary: colors.primary,
              secondary: colors.tertiary,
              text: colors.onPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

class _WheelPainter extends CustomPainter {
  _WheelPainter({
    required this.doors,
    required this.primary,
    required this.secondary,
    required this.text,
  });

  final List<int> doors;
  final Color primary;
  final Color secondary;
  final Color text;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide / 2;
    final sector = 2 * math.pi / doors.length;
    final paint = Paint();
    for (var i = 0; i < doors.length; i++) {
      // Sector i is centred i/n of a turn clockwise from the top.
      final start = -math.pi / 2 + sector * (i - 0.5);
      paint.color = i.isEven ? primary : secondary;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        start,
        sector,
        true,
        paint,
      );
      _paintLabel(
        canvas,
        center,
        radius,
        start + sector / 2,
        '${doors[i] + 1}',
      );
    }
  }

  void _paintLabel(
    Canvas canvas,
    Offset center,
    double radius,
    double direction,
    String label,
  ) {
    final painter = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: text,
          fontWeight: FontWeight.w700,
          fontSize: radius / (doors.length > 12 ? 9 : 6),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final at = center + Offset.fromDirection(direction, radius * 0.75);
    canvas.save();
    canvas.translate(at.dx, at.dy);
    canvas.rotate(direction + math.pi / 2);
    painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_WheelPainter old) =>
      old.doors != doors ||
      old.primary != primary ||
      old.secondary != secondary ||
      old.text != text;
}
