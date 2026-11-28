import 'package:flutter/foundation.dart';

enum PhotoAccess { full, blur }

enum ComplaintReason { inappropriate, notTask, other }

extension ComplaintReasonWire on ComplaintReason {
  String get wire => switch (this) {
    ComplaintReason.inappropriate => 'inappropriate',
    ComplaintReason.notTask => 'not_task',
    ComplaintReason.other => 'other',
  };
}

ComplaintReason _reasonOf(String wire) => switch (wire) {
  'inappropriate' => ComplaintReason.inappropriate,
  'not_task' => ComplaintReason.notTask,
  _ => ComplaintReason.other,
};

/// What only the organizer sees about a photo; a hint for moderation, never proof.
@immutable
class Moderation {
  const Moderation({
    required this.takenBefore,
    required this.source,
    required this.openComplaints,
    this.takenAt,
  });

  factory Moderation.fromJson(Map<String, dynamic> json) => Moderation(
    takenBefore: json['takenBefore'] as bool,
    takenAt: json['takenAt'] == null
        ? null
        : DateTime.parse(json['takenAt'] as String),
    source: json['source'] as String,
    openComplaints: json['openComplaints'] as int,
  );

  final bool takenBefore;
  final DateTime? takenAt;

  /// `camera`, `gallery` or `unknown`.
  final String source;
  final int openComplaints;
}

@immutable
class SubmissionItem {
  const SubmissionItem({
    required this.memberId,
    required this.displayName,
    required this.submittedAt,
    required this.access,
    required this.blurUrl,
    required this.width,
    required this.height,
    required this.mine,
    this.avatar,
    this.photoUrl,
    this.version,
    this.status,
    this.moderation,
  });

  /// Links arrive as server-relative paths and are resolved against [base].
  factory SubmissionItem.fromJson(Map<String, dynamic> json, Uri base) =>
      SubmissionItem(
        memberId: json['memberId'] as String,
        displayName: json['displayName'] as String,
        avatar: json['avatar'] as String?,
        submittedAt: DateTime.parse(json['submittedAt'] as String),
        access: json['access'] == 'full' ? PhotoAccess.full : PhotoAccess.blur,
        photoUrl: json['photoUrl'] == null
            ? null
            : base.resolve(json['photoUrl'] as String),
        blurUrl: base.resolve(json['blurUrl'] as String),
        width: json['width'] as int,
        height: json['height'] as int,
        mine: json['mine'] as bool,
        version: json['version'] as String?,
        status: json['status'] as String?,
        moderation: json['moderation'] == null
            ? null
            : Moderation.fromJson(json['moderation'] as Map<String, dynamic>),
      );

  final String memberId;
  final String displayName;
  final String? avatar;
  final DateTime submittedAt;
  final PhotoAccess access;

  /// Only when [access] is full.
  final Uri? photoUrl;
  final Uri blurUrl;
  final int width;
  final int height;
  final bool mine;

  /// Author only: the version to replace.
  final String? version;

  /// `visible` or `hidden`; author and organizer only.
  final String? status;
  final Moderation? moderation;

  bool get isHidden => status == 'hidden';
}

@immutable
class DaySubmissions {
  const DaySubmissions({
    required this.dayIndex,
    required this.revealAt,
    required this.revealed,
    required this.canSubmit,
    required this.items,
    required this.total,
    required this.serverTime,
    this.mine,
  });

  factory DaySubmissions.fromJson(Map<String, dynamic> json, Uri base) =>
      DaySubmissions(
        dayIndex: json['dayIndex'] as int,
        revealAt: DateTime.parse(json['revealAt'] as String),
        revealed: json['revealed'] as bool,
        canSubmit: json['canSubmit'] as bool,
        mine: json['mine'] == null
            ? null
            : SubmissionItem.fromJson(
                json['mine'] as Map<String, dynamic>,
                base,
              ),
        items: [
          for (final item in json['items'] as List<dynamic>)
            SubmissionItem.fromJson(item as Map<String, dynamic>, base),
        ],
        total: json['total'] as int,
        serverTime: DateTime.parse(json['serverTime'] as String),
      );

  final int dayIndex;
  final DateTime revealAt;
  final bool revealed;
  final bool canSubmit;
  final SubmissionItem? mine;
  final List<SubmissionItem> items;
  final int total;
  final DateTime serverTime;
}

@immutable
class ComplainerItem {
  const ComplainerItem({required this.memberId, required this.displayName});

  final String memberId;
  final String displayName;
}

@immutable
class ComplaintItem {
  const ComplaintItem({
    required this.dayIndex,
    required this.memberId,
    required this.displayName,
    required this.reasons,
    required this.complainers,
    required this.firstAt,
    required this.hidden,
  });

  factory ComplaintItem.fromJson(Map<String, dynamic> json) => ComplaintItem(
    dayIndex: json['dayIndex'] as int,
    memberId: json['memberId'] as String,
    displayName: json['displayName'] as String,
    reasons: {
      for (final entry in (json['reasons'] as Map<String, dynamic>).entries)
        _reasonOf(entry.key): entry.value as int,
    },
    complainers: [
      for (final complainer in json['complainers'] as List<dynamic>)
        ComplainerItem(
          memberId: (complainer as Map<String, dynamic>)['memberId'] as String,
          displayName: complainer['displayName'] as String,
        ),
    ],
    firstAt: DateTime.parse(json['firstAt'] as String),
    hidden: json['hidden'] as bool,
  );

  final int dayIndex;
  final String memberId;
  final String displayName;
  final Map<ComplaintReason, int> reasons;
  final List<ComplainerItem> complainers;
  final DateTime firstAt;
  final bool hidden;

  int get count => reasons.values.fold(0, (sum, value) => sum + value);
}
