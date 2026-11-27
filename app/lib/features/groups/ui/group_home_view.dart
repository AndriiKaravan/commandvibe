import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/group_home_view_model.dart';
import 'package:commandvibe/features/photos/ui/complaints_view.dart';
import 'package:commandvibe/features/today/ui/today_card.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// P1 group home: the live member list; the game tabs arrive in P4.
class GroupHomeView extends StatefulWidget {
  const GroupHomeView({
    super.key,
    required this.groupId,
    required this.isOwner,
  });

  final String groupId;
  final bool isOwner;

  @override
  State<GroupHomeView> createState() => _GroupHomeViewState();
}

class _GroupHomeViewState extends State<GroupHomeView> {
  GroupHomeViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel = GroupHomeViewModel(
        services.groups,
        services.realtime,
        groupId: widget.groupId,
        isOwner: widget.isOwner,
      )..addListener(_onChange);
      _viewModel!.start();
    }
  }

  Future<void> _onChange() async {
    if (_viewModel!.revoked && mounted) {
      final services = ServicesScope.of(context);
      await services.sessions.clear();
      services.realtime.authChanged();
      if (mounted) {
        context.go('/');
      }
    }
  }

  Future<void> _signOut() async {
    final services = ServicesScope.of(context);
    await services.sessions.clear();
    services.realtime.authChanged();
    if (mounted) {
      context.go('/');
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
    final text = Theme.of(context).textTheme;
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final viewModel = _viewModel!;
        return Scaffold(
          appBar: AppBar(
            title: Text(viewModel.groupName),
            backgroundColor: Colors.transparent,
            actions: [
              IconButton(
                tooltip: l10n.signOut,
                onPressed: _signOut,
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: TodayCard(groupId: widget.groupId),
                    ),
                    if (widget.isOwner)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: FilledButton.icon(
                          key: const Key('open-calendar'),
                          onPressed: () =>
                              context.go('/g/${widget.groupId}/calendar'),
                          icon: const Icon(Icons.calendar_month),
                          label: Text(l10n.groupCalendarButton),
                        ),
                      ),
                    if (widget.isOwner)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: ComplaintsButton(groupId: widget.groupId),
                      ),
                    if (widget.isOwner && viewModel.pending.isNotEmpty) ...[
                      Text(l10n.pendingMembers, style: text.titleMedium),
                      for (final member in viewModel.pending)
                        _MemberTile(
                          member: member,
                          actions: [
                            TextButton(
                              onPressed: () => viewModel.approve(member.id),
                              child: Text(l10n.approve),
                            ),
                            TextButton(
                              onPressed: () => viewModel.remove(member.id),
                              child: Text(l10n.remove),
                            ),
                          ],
                        ),
                      const SizedBox(height: 16),
                    ],
                    if (viewModel.loadFailed)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          l10n.networkError,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    Text(l10n.membersTitle, style: text.titleMedium),
                    for (final member in viewModel.active)
                      _MemberTile(
                        member: member,
                        actions: [
                          if (widget.isOwner && !member.isOrganizer)
                            IconButton(
                              tooltip: l10n.remove,
                              onPressed: () => viewModel.remove(member.id),
                              icon: const Icon(Icons.person_remove_outlined),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile({required this.member, required this.actions});

  final GroupMember member;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: GlassPanel(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      radius: 22,
      child: Row(
        children: [
          CircleAvatar(
            child: Text(member.displayName.characters.first.toUpperCase()),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              member.displayName,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          ...actions,
        ],
      ),
    ),
  );
}
