import 'package:commandvibe/core/ui/tab_page.dart';
import 'package:commandvibe/features/today/ui/today_card.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The "Today" tab; the day card and its photos, with progress blocks added around them.
class TodayTab extends StatelessWidget {
  const TodayTab({super.key, required this.groupId});

  final String groupId;

  @override
  Widget build(BuildContext context) => TabPage(
    title: AppLocalizations.of(context).tabToday,
    children: [TodayCard(groupId: groupId)],
  );
}
