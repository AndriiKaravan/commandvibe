import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/tab_page.dart';
import 'package:commandvibe/features/progress/ui/day_progress_card.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:commandvibe/features/standings/ui/my_place_card.dart';
import 'package:commandvibe/features/today/ui/events_card.dart';
import 'package:commandvibe/features/today/ui/events_view_model.dart';
import 'package:commandvibe/features/today/ui/today_card.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The "Today" tab: the day's task and photos, how the group is doing, my place, what just happened.
class TodayTab extends StatefulWidget {
  const TodayTab({super.key, required this.groupId});

  final String groupId;

  @override
  State<TodayTab> createState() => _TodayTabState();
}

class _TodayTabState extends State<TodayTab> {
  EventsViewModel? _events;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_events != null) {
      return;
    }
    final standings = GroupLive.of(context).standings;
    _events = EventsViewModel(
      ServicesScope.of(context).realtime,
      groupId: widget.groupId,
      nameOf: (memberId) {
        for (final item in standings.value?.items ?? const <StandingItem>[]) {
          if (item.memberId == memberId) {
            return item.displayName;
          }
        }
        return null;
      },
    )..start();
  }

  @override
  void dispose() {
    _events?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final live = GroupLive.of(context);
    return TabPage(
      title: AppLocalizations.of(context).tabToday,
      children: [
        TodayCard(
          groupId: widget.groupId,
          between: ListenableBuilder(
            listenable: live.progress,
            builder: (context, _) =>
                DayProgressCard(day: live.progress.value?.current),
          ),
        ),
        const SizedBox(height: 16),
        ListenableBuilder(
          listenable: live.standings,
          builder: (context, _) => MyPlaceCard(standings: live.standings.value),
        ),
        const SizedBox(height: 16),
        EventsCard(viewModel: _events!),
      ],
    );
  }
}
