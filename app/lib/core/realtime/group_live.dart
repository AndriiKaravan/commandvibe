import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/features/notifications/data/notifications_models.dart';
import 'package:commandvibe/features/progress/data/progress_models.dart';
import 'package:commandvibe/features/standings/data/standings_models.dart';
import 'package:flutter/widgets.dart';
import 'package:ks_core/ks_core.dart';

/// The group-wide values several tabs show, read once and shared: progress, standings and notifications.
///
/// One set of loaders per group keeps a photo event from costing one read per open tab.
class GroupLive {
  GroupLive(
    RealtimeClient realtime, {
    required this.groupId,
    required Future<GameProgress> Function() loadProgress,
    required Future<Standings> Function() loadStandings,
    required Future<NotificationsPage> Function() loadNotifications,
    required this.onRevoked,
  }) : progress = LiveLoader<GameProgress>(
         realtime,
         topic: 'group:$groupId',
         reloadOn: _progressEvents,
         load: loadProgress,
       ),
       standings = LiveLoader<Standings>(
         realtime,
         topic: 'group:$groupId',
         reloadOn: _standingsEvents,
         load: loadStandings,
       ),
       notifications = LiveLoader<NotificationsPage>(
         realtime,
         topic: 'group:$groupId',
         reloadOn: notificationEvents,
         load: loadNotifications,
       ) {
    progress.addListener(_checkRevoked);
    standings.addListener(_checkRevoked);
    notifications.addListener(_checkRevoked);
  }

  /// Progress counts who did the day; likes and comments do not change it.
  static const _progressEvents = {
    ...submissionEvents,
    ...membershipEvents,
    'day.opened',
    'game.finished',
  };

  /// Points also depend on likes.
  static const _standingsEvents = {..._progressEvents, ...likeEvents};

  final LiveLoader<GameProgress> progress;
  final LiveLoader<Standings> standings;
  final LiveLoader<NotificationsPage> notifications;
  final String groupId;

  /// Called once, when the server starts refusing this member's reads.
  final VoidCallback onRevoked;

  bool _reported = false;

  void start() {
    progress.start();
    standings.start();
    notifications.start();
  }

  void _checkRevoked() {
    if (!_reported &&
        (progress.revoked || standings.revoked || notifications.revoked)) {
      _reported = true;
      onRevoked();
    }
  }

  void dispose() {
    progress.dispose();
    standings.dispose();
    notifications.dispose();
  }

  /// The loaders of the group whose tabs [context] belongs to.
  static GroupLive of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<GroupLiveScope>()!.live;
}

class GroupLiveScope extends InheritedWidget {
  const GroupLiveScope({super.key, required this.live, required super.child});

  final GroupLive live;

  @override
  bool updateShouldNotify(GroupLiveScope oldWidget) => live != oldWidget.live;
}
