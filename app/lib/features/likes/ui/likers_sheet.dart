import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// Who liked a photo.
class LikersSheet extends StatelessWidget {
  const LikersSheet({super.key, required this.likers});

  final List<Liker> likers;

  static Future<void> show(BuildContext context, List<Liker> likers) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => LikersSheet(likers: likers),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.7,
        ),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Text(
              l10n.likersTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            for (final liker in likers)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  spacing: 12,
                  children: [
                    MemberAvatar(
                      displayName: liker.displayName,
                      avatar: liker.avatar,
                      size: 32,
                    ),
                    Expanded(child: Text(liker.displayName)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
