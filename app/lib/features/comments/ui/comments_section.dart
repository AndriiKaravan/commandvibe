import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/features/comments/data/comments_models.dart';
import 'package:commandvibe/features/comments/ui/comments_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The comments under one photo, live, with the field to add one.
class CommentsSection extends StatefulWidget {
  const CommentsSection({
    super.key,
    required this.groupId,
    required this.dayIndex,
    required this.authorMemberId,
    this.canWrite = true,
  });

  final String groupId;
  final int dayIndex;
  final String authorMemberId;

  /// False for an organizer who does not play: they read and delete, but do not write.
  final bool canWrite;

  @override
  State<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends State<CommentsSection> {
  CommentsViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel = CommentsViewModel(
        services.comments,
        services.realtime,
        groupId: widget.groupId,
        dayIndex: widget.dayIndex,
        authorMemberId: widget.authorMemberId,
      )..start();
    }
  }

  @override
  void dispose() {
    _viewModel?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final viewModel = _viewModel!;
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          Text(
            l10n.commentsTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (viewModel.loadFailed && !viewModel.isLoaded)
            Text(l10n.networkError)
          else
            CommentsList(items: viewModel.items, onDelete: viewModel.delete),
          if (widget.canWrite)
            CommentInput(
              sending: viewModel.sending,
              error: viewModel.error,
              onSend: viewModel.send,
            ),
        ],
      ),
    );
  }
}

/// Pure list of comments, oldest first as the server gives them.
class CommentsList extends StatelessWidget {
  const CommentsList({super.key, required this.items, required this.onDelete});

  final List<CommentItem> items;
  final void Function(String commentId) onDelete;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (items.isEmpty) {
      return Text(l10n.commentsEmpty);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        for (final item in items)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: [
              MemberAvatar(
                displayName: item.displayName,
                avatar: item.avatar,
                size: 30,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.displayName,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(item.text),
                  ],
                ),
              ),
              if (item.canDelete)
                IconButton(
                  key: Key('delete-comment-${item.id}'),
                  tooltip: l10n.commentDelete,
                  onPressed: () => onDelete(item.id),
                  icon: const Icon(Icons.delete_outline),
                ),
            ],
          ),
      ],
    );
  }
}

/// The field and send button; clears itself once the text is sent.
class CommentInput extends StatefulWidget {
  const CommentInput({
    super.key,
    required this.sending,
    required this.error,
    required this.onSend,
  });

  final bool sending;
  final CommentError? error;
  final Future<bool> Function(String text) onSend;

  @override
  State<CommentInput> createState() => _CommentInputState();
}

class _CommentInputState extends State<CommentInput> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (widget.sending) {
      return;
    }
    final text = _controller.text;
    if (await widget.onSend(text)) {
      _controller.clear();
    }
  }

  String? _errorText(AppLocalizations l10n) => switch (widget.error) {
    CommentError.empty => l10n.commentEmpty,
    CommentError.tooLong => l10n.commentTooLong,
    CommentError.failed => l10n.commentFailed,
    null => null,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 8,
      children: [
        Expanded(
          child: TextField(
            controller: _controller,
            minLines: 1,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: l10n.commentHint,
              errorText: _errorText(l10n),
            ),
            onSubmitted: (_) => _send(),
          ),
        ),
        IconButton.filled(
          key: const Key('send-comment'),
          tooltip: l10n.commentSend,
          onPressed: widget.sending ? null : _send,
          icon: const Icon(Icons.send),
        ),
      ],
    );
  }
}
