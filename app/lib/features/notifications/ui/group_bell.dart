import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/features/notifications/ui/bell_button.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The bell of the group the tab belongs to; nothing outside a group.
class GroupBell extends StatelessWidget {
  const GroupBell({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<GroupLiveScope>();
    if (scope == null) {
      return const SizedBox.shrink();
    }
    final live = scope.live;
    return ListenableBuilder(
      listenable: live.notifications,
      builder: (context, _) => BellButton(
        unread: live.notifications.value?.unread ?? 0,
        onPressed: () => context.push('/g/${live.groupId}/notifications'),
      ),
    );
  }
}
