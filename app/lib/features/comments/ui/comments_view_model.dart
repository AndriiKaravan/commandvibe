import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/features/comments/data/comments_models.dart';
import 'package:commandvibe/features/comments/data/comments_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';

enum CommentError { empty, tooLong, failed }

/// The same limit the server enforces, in characters (an emoji counts once).
const maxCommentLength = 500;

/// Comments under one photo, kept fresh over the group topic.
class CommentsViewModel extends ChangeNotifier {
  CommentsViewModel(
    this._repository,
    RealtimeClient realtime, {
    required this.groupId,
    required this.dayIndex,
    required this.authorMemberId,
  }) {
    _loader = LiveLoader<List<CommentItem>>(
      realtime,
      topic: 'group:$groupId',
      reloadOn: const {'comment.created', 'comment.deleted'},
      load: () => _repository.list(groupId, dayIndex, authorMemberId),
    )..addListener(notifyListeners);
  }

  final CommentsRepository _repository;
  final String groupId;
  final int dayIndex;
  final String authorMemberId;
  late final LiveLoader<List<CommentItem>> _loader;

  bool _sending = false;
  CommentError? _error;

  List<CommentItem> get items => _loader.value ?? const [];
  bool get isLoaded => _loader.isLoaded;
  bool get loadFailed => _loader.loadFailed;
  bool get sending => _sending;
  CommentError? get error => _error;

  void start() => _loader.start();

  Future<void> send(String raw) async {
    if (_sending) {
      return;
    }
    final text = raw.trim();
    if (text.isEmpty) {
      _fail(CommentError.empty);
      return;
    }
    if (text.runes.length > maxCommentLength) {
      _fail(CommentError.tooLong);
      return;
    }
    _sending = true;
    _error = null;
    notifyListeners();
    try {
      await _repository.add(groupId, dayIndex, authorMemberId, text);
      await _loader.reload();
    } on ApiException {
      _error = CommentError.failed;
    } on NetworkException {
      _error = CommentError.failed;
    } on TypeError {
      _error = CommentError.failed;
    }
    _sending = false;
    notifyListeners();
  }

  Future<void> delete(String commentId) async {
    try {
      await _repository.delete(groupId, dayIndex, authorMemberId, commentId);
      _error = null;
    } on ApiException {
      _error = CommentError.failed;
    } on NetworkException {
      _error = CommentError.failed;
    }
    await _loader.reload();
    notifyListeners();
  }

  void _fail(CommentError error) {
    _error = error;
    notifyListeners();
  }

  @override
  void dispose() {
    _loader.dispose();
    super.dispose();
  }
}
