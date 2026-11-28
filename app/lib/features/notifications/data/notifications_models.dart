import 'package:flutter/foundation.dart';

enum NotificationKind {
  dayOpened('day_opened'),
  photosRevealed('photos_revealed'),
  myTurn('my_turn'),
  reminder('reminder'),
  comment('comment'),
  likes('likes'),
  pendingMember('pending_member'),
  complaint('complaint'),
  unknown('');

  const NotificationKind(this.wireName);

  final String wireName;

  /// A kind this build does not know yet reads as [unknown], so a newer server cannot break the list.
  static NotificationKind fromWire(Object? name) => values.firstWhere(
    (kind) => kind.wireName == name && kind != unknown,
    orElse: () => unknown,
  );
}

@immutable
class AppNotification {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.createdAt,
    required this.read,
    this.dayIndex,
    this.actorName,
    this.count,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String,
        kind: NotificationKind.fromWire(json['kind']),
        dayIndex: json['dayIndex'] as int?,
        actorName: json['actorName'] as String?,
        count: json['count'] as int?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        read: json['read'] as bool,
      );

  final String id;
  final NotificationKind kind;
  final int? dayIndex;
  final String? actorName;
  final int? count;
  final DateTime createdAt;
  final bool read;
}

@immutable
class NotificationsPage {
  const NotificationsPage({required this.items, required this.unread});

  factory NotificationsPage.fromJson(Map<String, dynamic> json) =>
      NotificationsPage(
        items: [
          for (final item in json['items'] as List<dynamic>)
            AppNotification.fromJson(item as Map<String, dynamic>),
        ],
        unread: json['unread'] as int,
      );

  final List<AppNotification> items;
  final int unread;
}
