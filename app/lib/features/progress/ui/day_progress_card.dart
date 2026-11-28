import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// "7 of 12 have done it" with the bar towards the shared goal.
class DayProgressCard extends StatelessWidget {
  const DayProgressCard({super.key, required this.day});

  final DayProgress? day;

  @override
  Widget build(BuildContext context) {
    final progress = day;
    if (progress == null || progress.total == 0) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          Text(l10n.progressTitle, style: text.labelLarge),
          Text(
            l10n.progressCount(progress.done, progress.total),
            style: text.titleMedium,
          ),
          LinearProgressIndicator(
            value: progress.share,
            minHeight: 8,
            borderRadius: BorderRadius.circular(4),
          ),
          if (progress.goalReached)
            Row(
              key: const Key('goal-reached'),
              spacing: 6,
              children: [
                const Icon(Icons.celebration, size: 18),
                Text(l10n.progressGoalReached),
              ],
            )
          else
            Text(l10n.progressGoalHint, style: text.bodySmall),
        ],
      ),
    );
  }
}
