import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/core/ui/tab_page.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:commandvibe/features/standings/ui/rank_trend.dart';
import 'package:commandvibe/features/standings/ui/standings_list.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The "Rating" tab: the live board, with arrows for who just moved.
class StandingsView extends StatefulWidget {
  const StandingsView({super.key, required this.groupId});

  final String groupId;

  @override
  State<StandingsView> createState() => _StandingsViewState();
}

class _StandingsViewState extends State<StandingsView> {
  LiveLoader<Standings>? _loader;
  Standings? _shown;
  Map<String, int> _trend = const {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loader != null) {
      return;
    }
    final loader = _loader = GroupLive.of(context).standings;
    loader.addListener(_onLoaded);
    // Show what the group already has, without waiting for the next change.
    _shown = loader.value;
  }

  void _onLoaded() {
    final next = _loader?.value;
    if (next == null) {
      return;
    }
    final moved = RankTrend.between(_shown?.items, next.items);
    setState(() {
      // Arrows stay until somebody else moves, so a quiet reload does not erase them.
      if (moved.isNotEmpty) {
        _trend = moved;
      }
      _shown = next;
    });
  }

  @override
  void dispose() {
    _loader?.removeListener(_onLoaded);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final shown = _shown;
    return TabPage(
      title: l10n.tabRating,
      children: [
        if (shown == null)
          _loader!.loadFailed
              ? Text(l10n.networkError)
              : const Center(child: CircularProgressIndicator())
        else
          StandingsList(items: shown.items, trend: _trend),
      ],
    );
  }
}
