import 'package:commandvibe/features/notifications/data/notifications_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';

/// The line for an entry; the server sends kinds and facts, never text.
String notificationText(AppLocalizations l10n, AppNotification n) {
  final name = n.actorName;
  return switch (n.kind) {
    NotificationKind.dayOpened => l10n.notificationDayOpened,
    NotificationKind.photosRevealed => l10n.notificationPhotosRevealed,
    NotificationKind.myTurn => l10n.notificationMyTurn,
    NotificationKind.reminder => l10n.notificationReminder,
    NotificationKind.comment =>
      name == null
          ? l10n.notificationCommentAnonymous
          : l10n.notificationComment(name),
    NotificationKind.likes => l10n.notificationLikes(n.count ?? 0),
    NotificationKind.pendingMember =>
      name == null
          ? l10n.notificationPendingMemberAnonymous
          : l10n.notificationPendingMember(name),
    NotificationKind.complaint =>
      name == null
          ? l10n.notificationComplaintAnonymous
          : l10n.notificationComplaint(name),
    NotificationKind.unknown => l10n.notificationUnknown,
  };
}

/// Where tapping an entry leads.
String notificationRoute(String groupId, AppNotification n) => switch (n.kind) {
  NotificationKind.photosRevealed ||
  NotificationKind.likes ||
  NotificationKind.comment => '/g/$groupId/feed',
  NotificationKind.pendingMember => '/g/$groupId/me',
  NotificationKind.complaint => '/g/$groupId/complaints',
  _ => '/g/$groupId/today',
};
