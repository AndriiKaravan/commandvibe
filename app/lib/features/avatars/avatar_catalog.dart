import 'package:flutter/material.dart';

/// How one collection avatar looks: an icon on a coloured disc.
@immutable
class AvatarStyle {
  const AvatarStyle(this.icon, this.color);

  final IconData icon;
  final Color color;
}

/// The built-in collection; ids match the server's, so pictures can be swapped without an API change.
abstract final class AvatarCatalog {
  static const _styles = <AvatarStyle>[
    AvatarStyle(Icons.ac_unit, Color(0xFF3B82F6)),
    AvatarStyle(Icons.park, Color(0xFF16A34A)),
    AvatarStyle(Icons.star, Color(0xFFF59E0B)),
    AvatarStyle(Icons.cake, Color(0xFFEC4899)),
    AvatarStyle(Icons.celebration, Color(0xFF8B5CF6)),
    AvatarStyle(Icons.local_florist, Color(0xFFE11D48)),
    AvatarStyle(Icons.favorite, Color(0xFFDC2626)),
    AvatarStyle(Icons.pets, Color(0xFF92400E)),
    AvatarStyle(Icons.sports_esports, Color(0xFF4F46E5)),
    AvatarStyle(Icons.music_note, Color(0xFF0D9488)),
    AvatarStyle(Icons.camera_alt, Color(0xFF475569)),
    AvatarStyle(Icons.rocket_launch, Color(0xFF7C3AED)),
    AvatarStyle(Icons.emoji_nature, Color(0xFF65A30D)),
    AvatarStyle(Icons.coffee, Color(0xFF78350F)),
    AvatarStyle(Icons.icecream, Color(0xFFF472B6)),
    AvatarStyle(Icons.sailing, Color(0xFF0284C7)),
    AvatarStyle(Icons.palette, Color(0xFFEA580C)),
    AvatarStyle(Icons.beach_access, Color(0xFF0891B2)),
    AvatarStyle(Icons.lightbulb, Color(0xFFCA8A04)),
    AvatarStyle(Icons.diamond, Color(0xFF2563EB)),
    AvatarStyle(Icons.wb_sunny, Color(0xFFD97706)),
    AvatarStyle(Icons.nightlight, Color(0xFF312E81)),
    AvatarStyle(Icons.cabin, Color(0xFF166534)),
    AvatarStyle(Icons.redeem, Color(0xFFBE123C)),
  ];

  static final List<String> ids = List.unmodifiable([
    for (var i = 1; i <= _styles.length; i++)
      'av${i.toString().padLeft(2, '0')}',
  ]);

  static AvatarStyle? styleOf(String? id) {
    final index = id == null ? -1 : ids.indexOf(id);
    return index < 0 ? null : _styles[index];
  }
}
