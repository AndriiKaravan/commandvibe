import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/features/profile/profile_summary.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// "Me": avatar to change, points, place and days done.
class ProfileCard extends StatelessWidget {
  const ProfileCard({
    super.key,
    required this.summary,
    required this.onChangeAvatar,
  });

  final ProfileSummary summary;
  final VoidCallback onChangeAvatar;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return GlassPanel(
      child: Row(
        spacing: 16,
        children: [
          Tooltip(
            message: l10n.profileChangeAvatar,
            child: InkResponse(
              key: const Key('change-avatar'),
              onTap: onChangeAvatar,
              radius: 44,
              child: MemberAvatar(
                displayName: summary.displayName,
                avatar: summary.avatar,
                size: 64,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Text(summary.displayName, style: text.titleLarge),
                Row(
                  spacing: 12,
                  children: [
                    Text(l10n.myPlaceTitle(summary.rank)),
                    Text(l10n.pointsShort(summary.points)),
                  ],
                ),
                Text(l10n.profileDays(summary.daysDone, summary.daysSoFar)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
