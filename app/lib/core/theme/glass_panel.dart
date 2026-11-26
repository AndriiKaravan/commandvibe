import 'dart:ui';

import 'package:commandvibe/core/theme/glass_tokens.dart';
import 'package:flutter/material.dart';

/// A frosted panel; without blur it falls back to an opaque fill.
class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.radius,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  /// Defaults to the theme's [GlassTokens.radius].
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final glass =
        Theme.of(context).extension<GlassTokens>() ?? GlassTokens.dark;
    final shape = BorderRadius.circular(radius ?? glass.radius);
    final panel = DecoratedBox(
      decoration: BoxDecoration(
        color: glass.blurEnabled ? glass.fill : glass.solidFill,
        borderRadius: shape,
        border: Border.all(color: glass.border),
        boxShadow: [
          BoxShadow(
            color: glass.shadow,
            blurRadius: 50,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
    if (!glass.blurEnabled) {
      return panel;
    }
    return ClipRRect(
      borderRadius: shape,
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: glass.blurSigma,
          sigmaY: glass.blurSigma,
        ),
        child: panel,
      ),
    );
  }
}

/// The coloured background the glass sits on.
class GlassBackground extends StatelessWidget {
  const GlassBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final glass =
        Theme.of(context).extension<GlassTokens>() ?? GlassTokens.dark;
    final opacity = Theme.of(context).brightness == Brightness.dark
        ? 0.75
        : 0.5;
    Widget blob(Alignment alignment, Color color, double size) => Align(
      alignment: alignment,
      child: IgnorePointer(
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: opacity),
                color.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ),
    );
    return ColoredBox(
      color: glass.background,
      child: Stack(
        children: [
          blob(const Alignment(-1.2, -1.05), glass.blobs[0], 420),
          blob(const Alignment(1.25, -0.1), glass.blobs[1], 400),
          blob(const Alignment(-0.6, 1.2), glass.blobs[2], 380),
          Positioned.fill(child: child),
        ],
      ),
    );
  }
}
