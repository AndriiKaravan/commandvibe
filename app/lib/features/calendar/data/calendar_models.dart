import 'package:flutter/foundation.dart';

/// How the game picks a day's task (design 9; the other modes come later).
enum GameMode { auto, roulette }

/// Task categories of the catalog; the names are the wire format.
enum GameCategory {
  home,
  street,
  office,
  cheap,
  kids,
  winter,
  summer,
  team,
  pair,
}

enum DayState { closed, picking, open }

T _byName<T extends Enum>(List<T> values, Object? name, T fallback) =>
    values.asNameMap()[name] ?? fallback;

/// A text in Ukrainian with an optional English version.
@immutable
class TaskText {
  const TaskText({required this.uk, this.en});

  factory TaskText.fromJson(Map<String, dynamic> json) =>
      TaskText(uk: json['uk'] as String, en: json['en'] as String?);

  final String uk;
  final String? en;

  String forLanguage(String languageCode) =>
      languageCode == 'en' ? (en ?? uk) : uk;

  Map<String, Object> toJson() => {'uk': uk, 'en': ?en};
}

@immutable
class TaskItem {
  const TaskItem({
    this.id,
    required this.title,
    required this.description,
    required this.custom,
    required this.categories,
  });

  factory TaskItem.fromJson(Map<String, dynamic> json) => TaskItem(
    id: json['id'] as String?,
    title: TaskText.fromJson(json['title'] as Map<String, dynamic>),
    description: TaskText.fromJson(json['description'] as Map<String, dynamic>),
    custom: json['custom'] as bool? ?? false,
    categories: [
      for (final name in (json['categories'] as List<dynamic>? ?? const []))
        ?GameCategory.values.asNameMap()[name],
    ],
  );

  /// Catalog id; an organizer's own task has none.
  final String? id;
  final TaskText title;
  final TaskText description;
  final bool custom;
  final List<GameCategory> categories;
}

@immutable
class CalendarDay {
  const CalendarDay({
    required this.dayIndex,
    required this.date,
    required this.opensAt,
    required this.state,
    this.task,
    this.revealAt,
  });

  factory CalendarDay.fromJson(Map<String, dynamic> json) => CalendarDay(
    dayIndex: json['dayIndex'] as int,
    date: json['date'] as String,
    opensAt: DateTime.parse(json['opensAt'] as String),
    state: _byName(DayState.values, json['state'], DayState.closed),
    task: json['task'] == null
        ? null
        : TaskItem.fromJson(json['task'] as Map<String, dynamic>),
    revealAt: json['revealAt'] == null
        ? null
        : DateTime.parse(json['revealAt'] as String),
  );

  final int dayIndex;

  /// The day's date, YYYY-MM-DD in the group's time zone.
  final String date;
  final DateTime opensAt;
  final DayState state;

  /// Absent when the server hides it from a player.
  final TaskItem? task;

  /// When this open day's photos become visible to everyone.
  final DateTime? revealAt;

  /// The organizer may change a day only until it opens.
  bool get isEditable => state == DayState.closed;
}

@immutable
class GameInfo {
  const GameInfo({
    required this.startDate,
    required this.days,
    required this.openTime,
    required this.mode,
    required this.categories,
  });

  factory GameInfo.fromJson(Map<String, dynamic> json) => GameInfo(
    startDate: json['startDate'] as String,
    days: json['days'] as int,
    openTime: json['openTime'] as String,
    mode: _byName(GameMode.values, json['mode'], GameMode.auto),
    categories: [
      for (final name in (json['categories'] as List<dynamic>))
        ?GameCategory.values.asNameMap()[name],
    ],
  );

  final String startDate;
  final int days;
  final String openTime;
  final GameMode mode;
  final List<GameCategory> categories;
}

@immutable
class Calendar {
  const Calendar({this.game, required this.days, required this.serverTime});

  factory Calendar.fromJson(Map<String, dynamic> json) => Calendar(
    game: json['game'] == null
        ? null
        : GameInfo.fromJson(json['game'] as Map<String, dynamic>),
    days: [
      for (final day in (json['days'] as List<dynamic>))
        CalendarDay.fromJson(day as Map<String, dynamic>),
    ],
    serverTime: DateTime.parse(json['serverTime'] as String),
  );

  final GameInfo? game;
  final List<CalendarDay> days;
  final DateTime serverTime;
}

/// The organizer's game setup as the server expects it.
@immutable
class GameSetup {
  const GameSetup({
    required this.startDate,
    required this.days,
    required this.openTime,
    required this.mode,
    required this.categories,
  });

  final DateTime startDate;
  final int days;
  final String openTime;
  final GameMode mode;
  final Set<GameCategory> categories;

  Map<String, Object> toJson() => {
    'startDate': _dateOnly(startDate),
    'days': days,
    'openTime': openTime,
    'mode': mode.name,
    'categories': [for (final category in categories) category.name],
  };
}

String _dateOnly(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-'
    '${date.month.toString().padLeft(2, '0')}-'
    '${date.day.toString().padLeft(2, '0')}';

enum CustomTaskError {
  titleRequired,
  titleTooLong,
  descriptionRequired,
  descriptionTooLong,
}

/// A task the organizer writes; limits match the server's.
@immutable
class CustomTask {
  const CustomTask._({required this.title, required this.description});

  static const maxTitle = 60;
  static const maxDescription = 220;

  /// Validates the fields; English texts are optional and dropped when blank.
  static (CustomTask?, CustomTaskError?) tryCreate({
    required String title,
    required String description,
    String titleEn = '',
    String descriptionEn = '',
  }) {
    final name = title.trim();
    final text = description.trim();
    if (name.isEmpty) {
      return (null, CustomTaskError.titleRequired);
    }
    if (name.length > maxTitle) {
      return (null, CustomTaskError.titleTooLong);
    }
    if (text.isEmpty) {
      return (null, CustomTaskError.descriptionRequired);
    }
    if (text.length > maxDescription) {
      return (null, CustomTaskError.descriptionTooLong);
    }
    String? optional(String value) {
      final trimmed = value.trim();
      return trimmed.isEmpty ? null : trimmed;
    }

    return (
      CustomTask._(
        title: TaskText(uk: name, en: optional(titleEn)),
        description: TaskText(uk: text, en: optional(descriptionEn)),
      ),
      null,
    );
  }

  final TaskText title;
  final TaskText description;

  Map<String, Object> toJson() => {
    'custom': {'title': title.toJson(), 'description': description.toJson()},
  };
}
