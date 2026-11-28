import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/core/server_clock.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/tab_page.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/day_sheet.dart';
import 'package:commandvibe/features/calendar/ui/doors_grid.dart';
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
  ServerClock _clock = const ServerClock.device();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_calendar != null) {
      return;
    }
    final services = ServicesScope.of(context);
    _calendar =
        LiveLoader<Calendar>(
            services.realtime,
            topic: 'group:${widget.groupId}',
            reloadOn: const {
              'day.opened',
              'photos.revealed',
              'roulette.spin',
              'roulette.waiting',
              'game.finished',
            },
            load: () => services.calendar.calendar(widget.groupId),
          )
          ..addListener(_syncClock)
          ..start();
  }

  /// The device clock may be off; the server's time anchors the reveal marks, and keeps running.
  void _syncClock() {
    final loaded = _calendar?.value;
    if (loaded != null) {
      _clock = ServerClock.sync(serverTime: loaded.serverTime);
    }
  }

  @override
  void dispose() {
    _calendar?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final calendar = _calendar!;
    final progress = GroupLive.of(context).progress;
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
            return DoorsGrid(
              days: loaded.days,
              progress: progress.value,
              now: _clock.now(),
              onOpen: (day) =>
                  showDaySheet(context, groupId: widget.groupId, day: day),
            );
          },
        ),
      ],
    );
  }
}
