import 'package:commandvibe/features/feed/data/feed_models.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// "Mine", a day and a member; each narrows the feed, picking the same value again clears it.
class FeedFiltersBar extends StatelessWidget {
  const FeedFiltersBar({
    super.key,
    required this.filter,
    required this.days,
    required this.members,
    required this.onChanged,
  });

  final FeedFilter filter;

  /// Day indexes that can have photos.
  final List<int> days;
  final List<GroupMember> members;
  final ValueChanged<FeedFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        spacing: 8,
        children: [
          FilterChip(
            key: const Key('filter-mine'),
            label: Text(l10n.feedFilterMine),
            selected: filter.mine,
            onSelected: (value) => onChanged(
              FeedFilter(
                day: filter.day,
                memberId: filter.memberId,
                mine: value,
              ),
            ),
          ),
          PopupMenuButton<int?>(
            key: const Key('filter-day'),
            onSelected: (value) => onChanged(
              FeedFilter(
                day: value,
                memberId: filter.memberId,
                mine: filter.mine,
              ),
            ),
            itemBuilder: (context) => [
              PopupMenuItem(value: null, child: Text(l10n.feedFilterAll)),
              for (final day in days)
                PopupMenuItem(
                  value: day,
                  child: Text(l10n.daySheetTitle(day + 1)),
                ),
            ],
            child: Chip(
              label: Text(
                filter.day == null
                    ? l10n.feedFilterDay
                    : l10n.daySheetTitle(filter.day! + 1),
              ),
              backgroundColor: filter.day == null
                  ? null
                  : Theme.of(context).colorScheme.primaryContainer,
            ),
          ),
          PopupMenuButton<String?>(
            key: const Key('filter-member'),
            onSelected: (value) => onChanged(
              FeedFilter(day: filter.day, memberId: value, mine: filter.mine),
            ),
            itemBuilder: (context) => [
              PopupMenuItem(value: null, child: Text(l10n.feedFilterAll)),
              for (final member in members)
                PopupMenuItem(
                  value: member.id,
                  child: Text(member.displayName),
                ),
            ],
            child: Chip(
              label: Text(
                members
                        .where((m) => m.id == filter.memberId)
                        .map((m) => m.displayName)
                        .firstOrNull ??
                    l10n.feedFilterMember,
              ),
              backgroundColor: filter.memberId == null
                  ? null
                  : Theme.of(context).colorScheme.primaryContainer,
            ),
          ),
        ],
      ),
    );
  }
}
