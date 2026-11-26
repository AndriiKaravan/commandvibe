import 'package:commandvibe/core/theme/glass_tokens.dart';
import 'package:flutter/material.dart';

/// Light and dark themes of the "Glass" style.
abstract final class AppTheme {
  static ThemeData dark({bool blur = true}) =>
      _build(GlassTokens.dark.copyWith(blurEnabled: blur), Brightness.dark);

  static ThemeData light({bool blur = true}) =>
      _build(GlassTokens.light.copyWith(blurEnabled: blur), Brightness.light);

  static ThemeData _build(GlassTokens glass, Brightness brightness) {
    final onSurface = brightness == Brightness.dark
        ? Colors.white
        : const Color(0xFF1C1838);
    final scheme =
        ColorScheme.fromSeed(
          seedColor: glass.blobs.first,
          brightness: brightness,
        ).copyWith(
          surface: glass.background,
          onSurface: onSurface,
          primary: glass.primaryButton,
          onPrimary: glass.onPrimaryButton,
        );
    return ThemeData(
      colorScheme: scheme,
      scaffoldBackgroundColor: Colors.transparent,
      extensions: [glass],
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: glass.fill,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: glass.border),
        ),
      ),
      textTheme: Typography.material2021(
        platform: TargetPlatform.android,
      ).englishLike.apply(bodyColor: onSurface, displayColor: onSurface),
    );
  }
}
