import 'package:commandvibe/features/avatars/avatar_catalog.dart';
import 'package:flutter/material.dart';

/// Up to two capital letters from the first two words of [name]; "?" when empty.
String initialsOf(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  final letters = words.take(2).map((w) => w.characters.first.toUpperCase());
  final joined = letters.join();
  return joined.isEmpty ? '?' : joined;
}

/// A member's picture from the collection, or their initials when none is chosen.
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({
    super.key,
    required this.displayName,
    this.avatar,
    this.size = 40,
  });

  final String displayName;
  final String? avatar;
  final double size;

  @override
  Widget build(BuildContext context) {
    final style = AvatarCatalog.styleOf(avatar);
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: style?.color,
      foregroundColor: style == null ? null : Colors.white,
      child: style == null
          ? Text(
              initialsOf(displayName),
              style: TextStyle(fontSize: size * 0.38),
            )
          : Icon(style.icon, size: size * 0.55),
    );
  }
}
