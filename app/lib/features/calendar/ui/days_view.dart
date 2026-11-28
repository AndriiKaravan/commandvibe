import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/tab_page.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/day_sheet.dart';
import 'package:commandvibe/features/calendar/ui/doors_grid.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The "Calendar" tab: every door of the game, and the one place to catch up on missed days.
class DaysView extends StatefulWidget {
  const DaysView({super.key, required this.groupId});

  final String groupId;

  @override
  State<DaysView> createState() => _DaysViewState();
}

class _DaysViewState extends State<DaysView> {
  LiveLoader<Calendar>? _calendar;
  LiveLoader<GameProgress>? _progress;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_calendar != null) {
      return;
    }
    final services = ServicesScope.of(context);
    final topic = 'group:${widget.groupId}';
    _calendar = LiveLoader<Calendar>(
      services.realtime,
      topic: topic,
      reloadOn: const {
        'day.opened',
        'roulette.spin',
        'roulette.waiting',
        'game.finished',
      },
      load: () => services.calendar.calendar(widget.groupId),
    )..start();
    _progress = LiveLoader<GameProgress>(
      services.realtime,
      topic: topic,
      reloadOn: const {
        ...submissionEvents,
        ...membershipEvents,
        'day.opened',
        'game.finished',
      },
      load: () => services.progress.progress(widget.groupId),
    )..start();
  }

  @override
  void dispose() {
    _calendar?.dispose();
    _progress?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final calendar = _calendar!;
    final progress = _progress!;
    return TabPage(
      title: l10n.tabDays,
      children: [
        ListenableBuilder(
          listenable: Listenable.merge([calendar, progress]),
          builder: (context, _) {
            final loaded = calendar.value;
            if (loaded == null) {
              return calendar.loadFailed
                  ? Text(l10n.networkError)
                  : const Center(child: CircularProgressIndicator());
            }
            if (loaded.game == null || loaded.days.isEmpty) {
              return Text(l10n.daysNoGame);
            }
            // The device clock may be off; the server's time anchors the reveal marks.
            final skew = loaded.serverTime.difference(DateTime.now());
            return DoorsGrid(
              days: loaded.days,
              progress: progress.value,
              now: DateTime.now().add(skew),
              onOpen: (day) =>
                  showDaySheet(context, groupId: widget.groupId, day: day),
            );
          },
        ),
      ],
    );
  }
}
