import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/photos/ui/day_photos_section.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// One day of the game: its task, the player's own photo or the way to add one, and everyone's photos.
Future<void> showDaySheet(
  BuildContext context, {
  required String groupId,
  required CalendarDay day,
}) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (_) => DaySheet(groupId: groupId, day: day),
);

class DaySheet extends StatelessWidget {
  const DaySheet({super.key, required this.groupId, required this.day});

  final String groupId;
  final CalendarDay day;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final text = Theme.of(context).textTheme;
    final task = day.task;
    final date = DateFormat.MMMMd(
      locale.toString(),
    ).format(DateTime.parse(day.date));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      maxChildSize: 0.95,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          Text(l10n.daySheetTitle(day.dayIndex + 1), style: text.titleLarge),
          Text(date, style: text.bodySmall),
          if (task != null) ...[
            const SizedBox(height: 12),
            Text(l10n.daysTaskLabel, style: text.labelLarge),
            Text(
              task.title.forLanguage(locale.languageCode),
              style: text.titleMedium,
            ),
            Text(task.description.forLanguage(locale.languageCode)),
          ],
          const SizedBox(height: 16),
          DayPhotosCard(groupId: groupId, dayIndex: day.dayIndex),
        ],
      ),
    );
  }
}
