import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:flutter/foundation.dart';

/// One photo of the feed: the day-list item plus the day and task it belongs to.
@immutable
class FeedItem {
  const FeedItem({
    required this.photo,
    required this.dayIndex,
    required this.taskTitle,
    required this.revealAt,
  });

  /// Links arrive as server-relative paths and are resolved against [base].
  factory FeedItem.fromJson(Map<String, dynamic> json, Uri base) => FeedItem(
    photo: SubmissionItem.fromJson(json, base),
    dayIndex: json['dayIndex'] as int,
    taskTitle: TaskText.fromJson(json['taskTitle'] as Map<String, dynamic>),
    revealAt: DateTime.parse(json['revealAt'] as String),
  );

  final SubmissionItem photo;
  final int dayIndex;
  final TaskText taskTitle;
  final DateTime revealAt;

  /// One photo per author per day.
  String get key => '$dayIndex/${photo.memberId}';
}

@immutable
class FeedPage {
  const FeedPage({required this.items, this.next});

  factory FeedPage.fromJson(Map<String, dynamic> json, Uri base) => FeedPage(
    items: [
      for (final item in json['items'] as List<dynamic>)
        FeedItem.fromJson(item as Map<String, dynamic>, base),
    ],
    next: json['next'] as String?,
  );

  final List<FeedItem> items;

  /// Pass back to get the following page; null on the last one.
  final String? next;
}

@immutable
class FeedFilter {
  const FeedFilter({this.day, this.memberId, this.mine = false});

  final int? day;
  final String? memberId;
  final bool mine;

  bool get isEmpty => day == null && memberId == null && !mine;

  @override
  bool operator ==(Object other) =>
      other is FeedFilter &&
      other.day == day &&
      other.memberId == memberId &&
      other.mine == mine;

  @override
  int get hashCode => Object.hash(day, memberId, mine);
}
