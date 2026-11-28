import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/features/feed/data/feed_models.dart';
import 'package:commandvibe/features/likes/ui/like_button.dart';
import 'package:commandvibe/features/likes/ui/likers_sheet.dart';
import 'package:commandvibe/features/photos/ui/blurred_photo_tile.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// One photo of the feed: who, which day's task, and the picture or its blurred invitation.
class FeedCard extends StatelessWidget {
  const FeedCard({
    super.key,
    required this.item,
    required this.onOpen,
    required this.onImageFailed,
    this.onLike,
  });

  final FeedItem item;
  final VoidCallback onOpen;
  final VoidCallback onImageFailed;

  /// Gives or takes back my like; null where likes are not offered at all.
  final Future<void> Function(bool liked)? onLike;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final photo = item.photo;
    final language = Localizations.localeOf(context).languageCode;
    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Row(
            spacing: 10,
            children: [
              MemberAvatar(
                displayName: photo.displayName,
                avatar: photo.avatar,
                size: 36,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(photo.displayName, style: text.titleSmall),
                    Text(
                      l10n.feedDayTask(
                        item.dayIndex + 1,
                        item.taskTitle.forLanguage(language),
                      ),
                      style: text.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (photo.photoUrl != null)
            GestureDetector(
              key: const Key('feed-photo'),
              onTap: onOpen,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: AspectRatio(
                  aspectRatio: photo.width / photo.height,
                  child: Image.network(
                    photo.photoUrl.toString(),
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stack) {
                      WidgetsBinding.instance.addPostFrameCallback(
                        (_) => onImageFailed(),
                      );
                      return const ColoredBox(color: Colors.black26);
                    },
                  ),
                ),
              ),
            )
          else
            BlurredPhotoTile(
              blurUrl: photo.blurUrl,
              revealAt: item.revealAt,
              onImageFailed: onImageFailed,
              width: double.infinity,
              height: 260,
            ),
          if (photo.photoUrl != null && onLike != null)
            Align(
              alignment: Alignment.centerLeft,
              child: LikeButton(
                key: ValueKey('like-${item.key}'),
                likes: photo.likes,
                enabled: !photo.mine,
                onToggle: onLike!,
                onShowLikers: photo.likes.by == null
                    ? null
                    : () => LikersSheet.show(context, photo.likes.by!),
              ),
            ),
        ],
      ),
    );
  }
}
