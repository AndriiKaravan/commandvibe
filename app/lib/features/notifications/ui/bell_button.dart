import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The bell with the number of unread entries.
class BellButton extends StatelessWidget {
  const BellButton({super.key, required this.unread, required this.onPressed});

  final int unread;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    key: const Key('notifications-bell'),
    tooltip: AppLocalizations.of(context).notificationsBellTooltip,
    onPressed: onPressed,
    icon: Badge(
      isLabelVisible: unread > 0,
      label: Text(unread > 99 ? '99+' : '$unread'),
      child: const Icon(Icons.notifications_outlined),
    ),
  );
}
