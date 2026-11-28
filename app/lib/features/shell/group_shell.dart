import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/adaptive_shell.dart';
import 'package:commandvibe/features/shell/access_watcher.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The five tabs in route order; the fifth is the organizer's "Group" or a member's "Me".
List<ShellTab> groupTabs(AppLocalizations l10n, {required bool isOwner}) => [
  ShellTab(label: l10n.tabToday, icon: Icons.today),
  ShellTab(label: l10n.tabDays, icon: Icons.calendar_month),
  ShellTab(label: l10n.tabFeed, icon: Icons.photo_library),
  ShellTab(label: l10n.tabRating, icon: Icons.emoji_events),
  ShellTab(
    label: isOwner ? l10n.tabGroup : l10n.tabMe,
    icon: isOwner ? Icons.groups : Icons.person,
  ),
];

/// The five tabs of a group; the fifth is the organizer's "Group" or a member's "Me".
class GroupShell extends StatefulWidget {
  const GroupShell({
    super.key,
    required this.groupId,
    required this.isOwner,
    required this.currentIndex,
    required this.onSelected,
    required this.child,
  });

  final String groupId;
  final bool isOwner;
  final int currentIndex;
  final ValueChanged<int> onSelected;
  final Widget child;

  @override
  State<GroupShell> createState() => _GroupShellState();
}

class _GroupShellState extends State<GroupShell> {
  AccessWatcher? _watcher;
  GroupLive? _live;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_watcher != null) {
      return;
    }
    final services = ServicesScope.of(context);
    _watcher = AccessWatcher(
      services.realtime,
      groupId: widget.groupId,
      onRevoked: _leave,
    )..start();
    _live = GroupLive(
      services.realtime,
      groupId: widget.groupId,
      loadProgress: () => services.progress.progress(widget.groupId),
      loadStandings: () => services.standings.standings(widget.groupId),
      onRevoked: _leave,
    )..start();
  }

  Future<void> _leave() async {
    final services = ServicesScope.of(context);
    await services.sessions.clear();
    services.realtime.authChanged();
    if (mounted) {
      context.go('/');
    }
  }

  @override
  void dispose() {
    _watcher?.dispose();
    _live?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return GroupLiveScope(
      live: _live!,
      child: AdaptiveShell(
        currentIndex: widget.currentIndex,
        onSelected: widget.onSelected,
        tabs: groupTabs(l10n, isOwner: widget.isOwner),
        child: widget.child,
      ),
    );
  }
}
