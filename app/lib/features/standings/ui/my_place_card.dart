import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// "You are 4th, 6 points to 3rd" with the three leaders; only points and places, never who skipped.
class MyPlaceCard extends StatelessWidget {
  const MyPlaceCard({super.key, required this.standings});

  final Standings? standings;

  @override
  Widget build(BuildContext context) {
    final current = standings;
    if (current == null || current.items.isEmpty) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final me = current.me;
    final nextRank = current.nextRank;
    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          if (me != null) ...[
            Text(l10n.myPlaceTitle(me.rank), style: text.titleLarge),
            if (me.toNext != null && nextRank != null)
              Text(l10n.myPlaceGap(nextRank, me.toNext!))
            else
              Text(l10n.myPlaceLeader, key: const Key('place-leader')),
          ],
          Text(l10n.myPlaceLeaders, style: text.labelLarge),
          for (final leader in current.leaders(3))
            Row(
              spacing: 10,
              children: [
                MemberAvatar(
                  displayName: leader.displayName,
                  avatar: leader.avatar,
                  size: 32,
                ),
                Expanded(
                  child: Text(
                    leader.displayName,
                    style: TextStyle(
                      fontWeight: leader.mine
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ),
                Text(l10n.pointsShort(leader.points)),
              ],
            ),
        ],
      ),
    );
  }
}
