import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/groups/ui/create_group_view.dart';
import 'package:commandvibe/features/groups/ui/invite_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Organizer-only: warns, then replaces the group's invite link and shows the new one.
class InviteView extends StatefulWidget {
  const InviteView({super.key, required this.groupId});

  final String groupId;

  @override
  State<InviteView> createState() => _InviteViewState();
}

class _InviteViewState extends State<InviteView> {
  InviteViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _viewModel ??= InviteViewModel(
      ServicesScope.of(context).groups,
      groupId: widget.groupId,
    );
  }

  @override
  void dispose() {
    _viewModel?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final viewModel = _viewModel!;
        final url = viewModel.inviteUrl;
        if (url != null) {
          return ShareInvite(inviteUrl: url, groupId: widget.groupId);
        }
        return GlassPage(
          title: l10n.groupInviteButton,
          children: [
            Text(l10n.inviteRotateWarning),
            if (viewModel.failed) Text(l10n.inviteFailed),
            FilledButton(
              key: const Key('invite-rotate'),
              onPressed: viewModel.isBusy ? null : viewModel.rotate,
              child: Text(l10n.inviteRotateButton),
            ),
            TextButton(
              onPressed: () => context.go('/g/${widget.groupId}'),
              child: Text(l10n.toGroup),
            ),
          ],
        );
      },
    );
  }
}
