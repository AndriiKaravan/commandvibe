import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/tab_page.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
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
  LiveLoader<GameProgress>? _progress;
  LiveLoader<Standings>? _standings;
  EventsViewModel? _events;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_progress != null) {
      return;
    }
    final services = ServicesScope.of(context);
    final topic = 'group:${widget.groupId}';
    const reloadOn = {
      ...submissionEvents,
      ...membershipEvents,
      'day.opened',
      'game.finished',
    };
    _progress = LiveLoader<GameProgress>(
      services.realtime,
      topic: topic,
      reloadOn: reloadOn,
      load: () => services.progress.progress(widget.groupId),
    )..start();
    final standings = _standings = LiveLoader<Standings>(
      services.realtime,
      topic: topic,
      reloadOn: reloadOn,
      load: () => services.standings.standings(widget.groupId),
    )..start();
    _events = EventsViewModel(
      services.realtime,
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
    _progress?.dispose();
    _standings?.dispose();
    _events?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final progress = _progress!;
    final standings = _standings!;
    return TabPage(
      title: AppLocalizations.of(context).tabToday,
      children: [
        TodayCard(
          groupId: widget.groupId,
          between: ListenableBuilder(
            listenable: progress,
            builder: (context, _) =>
                DayProgressCard(day: progress.value?.current),
          ),
        ),
        const SizedBox(height: 16),
        ListenableBuilder(
          listenable: standings,
          builder: (context, _) => MyPlaceCard(standings: standings.value),
        ),
        const SizedBox(height: 16),
        EventsCard(viewModel: _events!),
      ],
    );
  }
}
