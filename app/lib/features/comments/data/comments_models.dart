import 'package:flutter/foundation.dart';

@immutable
class CommentItem {
  const CommentItem({
    required this.id,
    required this.memberId,
    required this.displayName,
    required this.text,
    required this.createdAt,
    required this.mine,
    required this.canDelete,
    this.avatar,
  });

  factory CommentItem.fromJson(Map<String, dynamic> json) => CommentItem(
    id: json['id'] as String,
    memberId: json['memberId'] as String,
    displayName: json['displayName'] as String,
    avatar: json['avatar'] as String?,
    text: json['text'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    mine: json['mine'] as bool,
    canDelete: json['canDelete'] as bool,
  );

  final String id;
  final String memberId;
  final String displayName;
  final String? avatar;
  final String text;
  final DateTime createdAt;
  final bool mine;
  final bool canDelete;
}
