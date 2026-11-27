import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// A blurred photo with the invitation laid over it: do the task and see it now, or wait for the reveal.
class BlurredPhotoTile extends StatelessWidget {
  const BlurredPhotoTile({
    super.key,
    required this.blurUrl,
    required this.revealAt,
    required this.onImageFailed,
    this.width = 170,
    this.height = 210,
  });

  final Uri blurUrl;
  final DateTime revealAt;
  final VoidCallback onImageFailed;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final local = revealAt.toLocal();
    final date = DateFormat.MMMMd(locale).format(local);
    final time = DateFormat('H:mm', locale).format(local);
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        width: width,
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.network(
              blurUrl.toString(),
              fit: BoxFit.cover,
              errorBuilder: (context, error, stack) {
                WidgetsBinding.instance.addPostFrameCallback(
                  (_) => onImageFailed(),
                );
                return const ColoredBox(color: Colors.black26);
              },
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.black26, Colors.black54],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.photoBlurTitle,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.photoBlurReveal(date, time),
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
