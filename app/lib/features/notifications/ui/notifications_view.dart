import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/notifications/data/notifications_models.dart';
import 'package:commandvibe/features/notifications/ui/notification_text.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The group's notification list, live; tapping an entry reads it and opens where it happened.
///
/// It sits outside the tab shell, so it keeps its own loader next to the shell's bell.
class NotificationsView extends StatefulWidget {
  const NotificationsView({super.key, required this.groupId});

  final String groupId;

  @override
  State<NotificationsView> createState() => _NotificationsViewState();
}

class _NotificationsViewState extends State<NotificationsView> {
  LiveLoader<NotificationsPage>? _loader;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loader == null) {
      final services = ServicesScope.of(context);
      _loader = LiveLoader<NotificationsPage>(
        services.realtime,
        topic: 'group:${widget.groupId}',
        reloadOn: notificationEvents,
        load: () => services.notifications.list(widget.groupId),
      )..start();
    }
  }

  @override
  void dispose() {
    _loader?.dispose();
    super.dispose();
  }

  Future<void> _open(AppNotification n) async {
    final services = ServicesScope.of(context);
    final router = GoRouter.of(context);
    if (!n.read) {
      try {
        await services.notifications.markRead(widget.groupId, ids: [n.id]);
      } on ApiException {
        // Reading is a courtesy; the entry still opens.
      } on NetworkException {
        // Same: offline must not block opening it.
      }
    }
    router.go(notificationRoute(widget.groupId, n));
  }

  Future<void> _markAll() async {
    final services = ServicesScope.of(context);
    try {
      await services.notifications.markRead(widget.groupId);
      await _loader!.reload();
    } on ApiException {
      // The list keeps showing what the server still has.
    } on NetworkException {
      // Offline: nothing changed.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final loader = _loader!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.notificationsTitle),
        backgroundColor: Colors.transparent,
        actions: [
          ListenableBuilder(
            listenable: loader,
            builder: (context, _) => IconButton(
              tooltip: l10n.notificationsMarkAllRead,
              onPressed: (loader.value?.unread ?? 0) > 0 ? _markAll : null,
              icon: const Icon(Icons.done_all),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListenableBuilder(
              listenable: loader,
              builder: (context, _) {
                final page = loader.value;
                if (page == null) {
                  return loader.loadFailed
                      ? Center(child: Text(l10n.networkError))
                      : const Center(child: CircularProgressIndicator());
                }
                return NotificationsList(items: page.items, onOpen: _open);
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Entries under a heading per game day; unread ones in bold.
class NotificationsList extends StatelessWidget {
  const NotificationsList({
    super.key,
    required this.items,
    required this.onOpen,
  });

  final List<AppNotification> items;
  final ValueChanged<AppNotification> onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (items.isEmpty) {
      return Center(child: Text(l10n.notificationsEmpty));
    }
    final text = Theme.of(context).textTheme;
    final children = <Widget>[];
    int? shownDay;
    for (final n in items) {
      if (n.dayIndex != null && n.dayIndex != shownDay) {
        shownDay = n.dayIndex;
        children.add(
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(
              l10n.daySheetTitle(n.dayIndex! + 1),
              style: text.titleSmall,
            ),
          ),
        );
      }
      children.add(
        GlassPanel(
          child: InkWell(
            onTap: () => onOpen(n),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                notificationText(l10n, n),
                style: TextStyle(
                  fontWeight: n.read ? FontWeight.w400 : FontWeight.w700,
                ),
              ),
            ),
          ),
        ),
      );
      children.add(const SizedBox(height: 8));
    }
    return ListView(padding: const EdgeInsets.all(16), children: children);
  }
}
