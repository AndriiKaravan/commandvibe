import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The rating rows; a row slides to its new place when the order changes.
class StandingsList extends StatelessWidget {
  const StandingsList({super.key, required this.items, required this.trend});

  final List<StandingItem> items;

  /// Places gained or lost since the previous reading, by member id.
  final Map<String, int> trend;

  static const rowHeight = 60.0;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(child: Text(AppLocalizations.of(context).ratingEmpty));
    }
    return SizedBox(
      height: rowHeight * items.length,
      child: Stack(
        children: [
          for (var index = 0; index < items.length; index++)
            AnimatedPositioned(
              key: ValueKey(items[index].memberId),
              duration: const Duration(milliseconds: 400),
              curve: Curves.easeInOut,
              top: index * rowHeight,
              left: 0,
              right: 0,
              height: rowHeight,
              child: _Row(
                item: items[index],
                change: trend[items[index].memberId],
              ),
            ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.item, required this.change});

  final StandingItem item;
  final int? change;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final moved = change ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: DecoratedBox(
        key: Key('standing-${item.displayName}${item.mine ? '-mine' : ''}'),
        decoration: BoxDecoration(
          color: item.mine
              ? scheme.primaryContainer
              : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            spacing: 10,
            children: [
              SizedBox(
                width: 28,
                child: Text(
                  '${item.rank}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              MemberAvatar(
                displayName: item.displayName,
                avatar: item.avatar,
                size: 34,
              ),
              Expanded(
                child: Text(
                  item.displayName,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: item.mine ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
              if (item.fans > 0) Text('❤ ${item.fans}'),
              if (moved != 0)
                Text(
                  moved > 0 ? '↑$moved' : '↓${-moved}',
                  style: TextStyle(
                    color: moved > 0 ? Colors.green.shade700 : scheme.error,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              Text(l10n.pointsShort(item.points)),
            ],
          ),
        ),
      ),
    );
  }
}
