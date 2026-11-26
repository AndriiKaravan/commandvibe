import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

/// "Glass" style tokens (owner's choice 26.11, mockups E dark / E2 light).
@immutable
class GlassTokens extends ThemeExtension<GlassTokens> {
  const GlassTokens({
    required this.background,
    required this.blobs,
    required this.fill,
    required this.solidFill,
    required this.border,
    required this.highlight,
    required this.shadow,
    required this.textSecondary,
    required this.primaryButton,
    required this.onPrimaryButton,
    required this.blurSigma,
    required this.radius,
    required this.blurEnabled,
  });

  static const dark = GlassTokens(
    background: Color(0xFF1B1640),
    blobs: [Color(0xFFC33DD6), Color(0xFF2FB8C9), Color(0xFFF2A33A)],
    fill: Color(0x24FFFFFF),
    solidFill: Color(0xF02A2456),
    border: Color(0x6BFFFFFF),
    highlight: Color(0x8CFFFFFF),
    shadow: Color(0x590A0628),
    textSecondary: Color(0xD9FFFFFF),
    primaryButton: Color(0xFFFFFFFF),
    onPrimaryButton: Color(0xFF1B1640),
    blurSigma: 24,
    radius: 30,
    blurEnabled: true,
  );

  static const light = GlassTokens(
    background: Color(0xFFF5F2FF),
    blobs: [Color(0xFFE85BD8), Color(0xFF5FD4E8), Color(0xFFFFC24D)],
    fill: Color(0x8CFFFFFF),
    solidFill: Color(0xF5FFFFFF),
    border: Color(0xF2FFFFFF),
    highlight: Color(0xFFFFFFFF),
    shadow: Color(0x293C288C),
    textSecondary: Color(0xFF4A4566),
    primaryButton: Color(0xFF1C1838),
    onPrimaryButton: Color(0xFFFFFFFF),
    blurSigma: 24,
    radius: 30,
    blurEnabled: true,
  );

  final Color background;

  /// Soft colour spots behind the glass.
  final List<Color> blobs;

  /// Panel fill over a blurred background.
  final Color fill;

  /// Panel fill when blur is off: opaque enough for text on its own.
  final Color solidFill;
  final Color border;

  /// Thin top inner light of a panel.
  final Color highlight;
  final Color shadow;
  final Color textSecondary;
  final Color primaryButton;
  final Color onPrimaryButton;
  final double blurSigma;
  final double radius;

  /// False on devices where BackdropFilter costs too much (fallback measured in the day-1 spike).
  final bool blurEnabled;

  @override
  GlassTokens copyWith({bool? blurEnabled}) => GlassTokens(
    background: background,
    blobs: blobs,
    fill: fill,
    solidFill: solidFill,
    border: border,
    highlight: highlight,
    shadow: shadow,
    textSecondary: textSecondary,
    primaryButton: primaryButton,
    onPrimaryButton: onPrimaryButton,
    blurSigma: blurSigma,
    radius: radius,
    blurEnabled: blurEnabled ?? this.blurEnabled,
  );

  @override
  GlassTokens lerp(covariant GlassTokens? other, double t) {
    if (other == null) {
      return this;
    }
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return GlassTokens(
      background: mix(background, other.background),
      blobs: [
        for (var i = 0; i < blobs.length; i++)
          mix(blobs[i], other.blobs[i % other.blobs.length]),
      ],
      fill: mix(fill, other.fill),
      solidFill: mix(solidFill, other.solidFill),
      border: mix(border, other.border),
      highlight: mix(highlight, other.highlight),
      shadow: mix(shadow, other.shadow),
      textSecondary: mix(textSecondary, other.textSecondary),
      primaryButton: mix(primaryButton, other.primaryButton),
      onPrimaryButton: mix(onPrimaryButton, other.onPrimaryButton),
      blurSigma: lerpDouble(blurSigma, other.blurSigma, t)!,
      radius: lerpDouble(radius, other.radius, t)!,
      blurEnabled: t < 0.5 ? blurEnabled : other.blurEnabled,
    );
  }
}
