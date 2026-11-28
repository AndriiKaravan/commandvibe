import 'package:commandvibe/features/likes/ui/like_view_model.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// A heart with the number of likes; the number opens the names when the group shows them.
class LikeButton extends StatefulWidget {
  const LikeButton({
    super.key,
    required this.likes,
    required this.enabled,
    required this.onToggle,
    this.onShowLikers,
  });

  final LikeInfo likes;

  /// False under my own photo and anywhere liking is not allowed: only the count is shown.
  final bool enabled;
  final Future<void> Function(bool liked) onToggle;
  final VoidCallback? onShowLikers;

  @override
  State<LikeButton> createState() => _LikeButtonState();
}

class _LikeButtonState extends State<LikeButton> {
  late final LikeViewModel _viewModel = LikeViewModel(
    initial: widget.likes,
    send: widget.onToggle,
  );

  Future<void> _toggle(AppLocalizations l10n) async {
    await _viewModel.toggle();
    if (_viewModel.failed && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.likeFailed)));
    }
  }

  @override
  void didUpdateWidget(LikeButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    _viewModel.sync(widget.likes);
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel,
      builder: (context, _) {
        final info = _viewModel.info;
        final canShowNames =
            widget.onShowLikers != null && !info.namesHidden && info.count > 0;
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              key: const Key('like-button'),
              tooltip: info.mine ? l10n.unlikeTooltip : l10n.likeTooltip,
              onPressed: widget.enabled ? () => _toggle(l10n) : null,
              icon: Icon(
                info.mine ? Icons.favorite : Icons.favorite_border,
                color: info.mine ? Colors.red : null,
              ),
            ),
            if (canShowNames)
              InkWell(
                key: const Key('like-count'),
                onTap: widget.onShowLikers,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 8,
                  ),
                  child: Text('${info.count}'),
                ),
              )
            else
              Text('${info.count}'),
          ],
        );
      },
    );
  }
}
