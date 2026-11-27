import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/ui/blurred_photo_tile.dart';
import 'package:commandvibe/features/photos/ui/day_photos_view_model.dart';
import 'package:commandvibe/features/photos/ui/submit_sheet.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The photos of today under the task card: the way to submit, and a strip of what the group has sent.
class DayPhotosCard extends StatefulWidget {
  const DayPhotosCard({
    super.key,
    required this.groupId,
    required this.dayIndex,
  });

  final String groupId;
  final int dayIndex;

  @override
  State<DayPhotosCard> createState() => _DayPhotosCardState();
}

class _DayPhotosCardState extends State<DayPhotosCard> {
  DayPhotosViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel = DayPhotosViewModel(
        services.photoSubmissions,
        services.realtime,
        groupId: widget.groupId,
        dayIndex: widget.dayIndex,
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
    final viewModel = _viewModel!;
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        final day = viewModel.day;
        if (day == null) {
          return const SizedBox.shrink();
        }
        return DayPhotosSection(
          day: day,
          loadFailed: viewModel.loadFailed,
          onImageFailed: viewModel.imageFailed,
          onOpen: (item) => context.push(
            '/g/${widget.groupId}/photo/${widget.dayIndex}/${item.memberId}',
          ),
          onSubmit: () async {
            await showSubmitSheet(
              context,
              groupId: widget.groupId,
              dayIndex: widget.dayIndex,
            );
            await viewModel.load();
          },
        );
      },
    );
  }
}

/// Pure presentation of one day's photos; the card above feeds it.
class DayPhotosSection extends StatelessWidget {
  const DayPhotosSection({
    super.key,
    required this.day,
    required this.loadFailed,
    required this.onSubmit,
    required this.onOpen,
    required this.onImageFailed,
  });

  final DaySubmissions day;
  final bool loadFailed;
  final VoidCallback onSubmit;
  final void Function(SubmissionItem item) onOpen;
  final VoidCallback onImageFailed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final mine = day.mine;
    final tiles = [?mine, ...day.items];
    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Row(
            children: [
              Expanded(child: Text(l10n.photosTitle, style: text.labelLarge)),
              Text(l10n.photoCount(day.total), style: text.labelMedium),
            ],
          ),
          _actions(context, l10n),
          if (day.canSubmit && day.revealed) Text(l10n.photoLateHint),
          if (tiles.isEmpty)
            Text(l10n.photoNoOthers)
          else
            SizedBox(
              height: 210,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: tiles.length,
                separatorBuilder: (_, _) => const SizedBox(width: 10),
                itemBuilder: (context, index) => _tile(tiles[index]),
              ),
            ),
          if (loadFailed) FormMessage(l10n.networkError),
        ],
      ),
    );
  }

  Widget _actions(BuildContext context, AppLocalizations l10n) {
    final mine = day.mine;
    if (mine == null) {
      return day.canSubmit
          ? FilledButton.icon(
              key: const Key('submit-photo'),
              onPressed: onSubmit,
              icon: const Icon(Icons.photo_camera_outlined),
              label: Text(l10n.photoSubmit),
            )
          : const SizedBox.shrink();
    }
    return Row(
      spacing: 8,
      children: [
        Chip(
          avatar: const Icon(Icons.check_circle_outline),
          label: Text(l10n.photoDone),
        ),
        if (!day.revealed && !mine.isHidden)
          TextButton(
            key: const Key('replace-photo'),
            onPressed: onSubmit,
            child: Text(l10n.photoReplace),
          ),
        if (mine.isHidden) Text(l10n.photoHiddenBadge),
      ],
    );
  }

  Widget _tile(SubmissionItem item) {
    if (item.access == PhotoAccess.blur) {
      return BlurredPhotoTile(
        blurUrl: item.blurUrl,
        revealAt: day.revealAt,
        onImageFailed: onImageFailed,
      );
    }
    return GestureDetector(
      key: Key('photo-${item.memberId}'),
      onTap: () => onOpen(item),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          width: 170,
          height: 210,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.network(
                item.photoUrl.toString(),
                fit: BoxFit.cover,
                errorBuilder: (context, error, stack) {
                  WidgetsBinding.instance.addPostFrameCallback(
                    (_) => onImageFailed(),
                  );
                  return const ColoredBox(color: Colors.black26);
                },
              ),
              Align(
                alignment: Alignment.bottomLeft,
                child: Container(
                  margin: const EdgeInsets.all(8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    item.displayName,
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
