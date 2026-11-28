import 'package:commandvibe/core/realtime/group_live.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/core/ui/tab_page.dart';
import 'package:commandvibe/features/avatars/avatar_picker_sheet.dart';
import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/group_home_view_model.dart';
import 'package:commandvibe/features/photos/ui/complaints_view.dart';
import 'package:commandvibe/features/profile/profile_card.dart';
import 'package:commandvibe/features/profile/profile_summary.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The fifth tab: "Me" for a member, "Group" for the organizer, who also gets the group's tools.
class ProfileView extends StatefulWidget {
  const ProfileView({super.key, required this.groupId, required this.isOwner});

  final String groupId;
  final bool isOwner;

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  GroupHomeViewModel? _group;
  GroupLive? _live;
  bool _leaving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_group != null) {
      return;
    }
    final services = ServicesScope.of(context);
    _group =
        GroupHomeViewModel(
            services.groups,
            services.realtime,
            groupId: widget.groupId,
            isOwner: widget.isOwner,
          )
          ..addListener(_onGroupChanged)
          ..start();
    _live = GroupLive.of(context);
  }

  @override
  void dispose() {
    _group?.dispose();
    super.dispose();
  }

  /// The server refused the group read: this member no longer belongs, so leave.
  void _onGroupChanged() {
    if (_group?.revoked == true && mounted && !_leaving) {
      _leaving = true;
      _signOut(revoked: true);
    }
  }

  /// A revoked member cannot authorize the token removal, so only a chosen sign-out sends it.
  Future<void> _signOut({bool revoked = false}) async {
    final services = ServicesScope.of(context);
    if (revoked) {
      await services.sessions.clear();
    } else {
      await services.push.signOut();
    }
    services.realtime.authChanged();
    if (mounted) {
      context.go('/');
    }
  }

  Future<void> _changeAvatar(ProfileSummary summary) {
    final services = ServicesScope.of(context);
    return AvatarPickerSheet.show(
      context,
      displayName: summary.displayName,
      current: summary.avatar,
      onPick: (id) async {
        await services.groups.setAvatar(widget.groupId, id);
        await _live!.standings.reload();
        await _group!.reload();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final group = _group!;
    return ListenableBuilder(
      listenable: Listenable.merge([group, _live!.standings, _live!.progress]),
      builder: (context, _) {
        final summary = ProfileSummary.from(
          standings: _live!.standings.value,
          progress: _live!.progress.value,
        );
        return TabPage(
          title: group.groupName.isEmpty
              ? (widget.isOwner ? l10n.tabGroup : l10n.tabMe)
              : group.groupName,
          children: [
            if (summary != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ProfileCard(
                  summary: summary,
                  onChangeAvatar: () => _changeAvatar(summary),
                ),
              ),
            if (summary != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: OutlinedButton.icon(
                  key: const Key('open-points'),
                  onPressed: () => context.push('/g/${widget.groupId}/points'),
                  icon: const Icon(Icons.receipt_long),
                  label: Text(l10n.profilePointsJournal),
                ),
              ),
            if (!widget.isOwner)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: OutlinedButton.icon(
                  key: const Key('change-pin'),
                  onPressed: () => context.go('/pin?g=${widget.groupId}'),
                  icon: const Icon(Icons.pin_outlined),
                  label: Text(l10n.profileChangePin),
                ),
              ),
            if (widget.isOwner) ..._tools(context, l10n, group),
            if (group.loadFailed)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  l10n.networkError,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            Text(
              l10n.membersTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            for (final member in group.active)
              _MemberTile(
                member: member,
                actions: [
                  if (widget.isOwner && !member.isOrganizer)
                    IconButton(
                      tooltip: l10n.remove,
                      onPressed: () => group.remove(member.id),
                      icon: const Icon(Icons.person_remove_outlined),
                    ),
                ],
              ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              key: const Key('sign-out'),
              onPressed: _signOut,
              icon: const Icon(Icons.logout),
              label: Text(l10n.signOut),
            ),
          ],
        );
      },
    );
  }

  List<Widget> _tools(
    BuildContext context,
    AppLocalizations l10n,
    GroupHomeViewModel group,
  ) {
    final text = Theme.of(context).textTheme;
    Widget spaced(Widget child) =>
        Padding(padding: const EdgeInsets.only(bottom: 16), child: child);
    return [
      spaced(
        FilledButton.icon(
          key: const Key('open-calendar'),
          onPressed: () => context.go('/g/${widget.groupId}/calendar'),
          icon: const Icon(Icons.edit_calendar),
          label: Text(l10n.groupCalendarButton),
        ),
      ),
      spaced(
        OutlinedButton.icon(
          key: const Key('open-invite'),
          onPressed: () => context.go('/g/${widget.groupId}/invite'),
          icon: const Icon(Icons.person_add),
          label: Text(l10n.groupInviteButton),
        ),
      ),
      spaced(ComplaintsButton(groupId: widget.groupId)),
      spaced(
        SwitchListTile(
          key: const Key('likes-count-only'),
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.groupLikesCountOnly),
          subtitle: Text(l10n.groupLikesCountOnlyHint),
          value: group.likesCountOnly,
          onChanged: group.setLikesCountOnly,
        ),
      ),
      spaced(
        OutlinedButton.icon(
          key: const Key('open-my-groups'),
          onPressed: () => context.go('/org/groups?all=1'),
          icon: const Icon(Icons.groups),
          label: Text(l10n.myGroupsTitle),
        ),
      ),
      if (group.pending.isNotEmpty) ...[
        Text(l10n.pendingMembers, style: text.titleMedium),
        for (final member in group.pending)
          _MemberTile(
            member: member,
            actions: [
              TextButton(
                onPressed: () => group.approve(member.id),
                child: Text(l10n.approve),
              ),
              TextButton(
                onPressed: () => group.remove(member.id),
                child: Text(l10n.remove),
              ),
            ],
          ),
        const SizedBox(height: 16),
      ],
    ];
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
          MemberAvatar(
            displayName: member.displayName,
            avatar: member.avatar,
            size: 36,
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
