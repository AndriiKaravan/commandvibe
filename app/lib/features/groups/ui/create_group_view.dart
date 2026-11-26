import 'package:commandvibe/core/platform/session_store.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/groups/ui/create_group_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

Future<String> _deviceTimeZone() async =>
    (await FlutterTimezone.getLocalTimezone()).identifier;

class CreateGroupView extends StatefulWidget {
  const CreateGroupView({super.key});

  @override
  State<CreateGroupView> createState() => _CreateGroupViewState();
}

class _CreateGroupViewState extends State<CreateGroupView> {
  final _name = TextEditingController();
  CreateGroupViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _viewModel ??= CreateGroupViewModel(
      ServicesScope.of(context).groups,
      timezone: _deviceTimeZone,
    )..addListener(_onChange);
  }

  Future<void> _onChange() async {
    final created = _viewModel!.created;
    if (created == null) {
      return;
    }
    // The organizer's session remembers the last group so the app reopens it.
    final sessions = ServicesScope.of(context).sessions;
    final session = await sessions.read();
    if (session != null) {
      await sessions.write(
        StoredSession(
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          kind: session.kind,
          groupId: created.groupId,
        ),
      );
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _viewModel?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final created = _viewModel!.created;
        if (created != null) {
          return _ShareInvite(
            inviteUrl: created.inviteUrl,
            groupId: created.groupId,
          );
        }
        return GlassPage(
          title: l10n.createGroupTitle,
          children: [
            TextField(
              controller: _name,
              maxLength: 60,
              decoration: InputDecoration(labelText: l10n.groupNameLabel),
            ),
            SwitchListTile(
              value: _viewModel!.playsToo,
              onChanged: _viewModel!.setPlaysToo,
              title: Text(l10n.playsTooLabel),
            ),
            SwitchListTile(
              value: _viewModel!.approveNew,
              onChanged: _viewModel!.setApproveNew,
              title: Text(l10n.approveNewLabel),
            ),
            if (_viewModel!.error == CreateGroupError.invalidName)
              FormMessage(l10n.invalidName),
            if (_viewModel!.error == CreateGroupError.failed)
              FormMessage(l10n.genericError),
            FilledButton(
              onPressed: _viewModel!.isBusy
                  ? null
                  : () => _viewModel!.create(_name.text),
              child: Text(l10n.createGroupAction),
            ),
          ],
        );
      },
    );
  }
}

class _ShareInvite extends StatelessWidget {
  const _ShareInvite({required this.inviteUrl, required this.groupId});

  final String inviteUrl;
  final String groupId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return GlassPage(
      title: l10n.inviteTitle,
      children: [
        Text(l10n.inviteBody),
        SelectableText(
          inviteUrl,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        FilledButton.icon(
          onPressed: () =>
              SharePlus.instance.share(ShareParams(uri: Uri.parse(inviteUrl))),
          icon: const Icon(Icons.ios_share),
          label: Text(l10n.shareInvite),
        ),
        OutlinedButton.icon(
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: inviteUrl));
            if (context.mounted) {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(l10n.copied)));
            }
          },
          icon: const Icon(Icons.copy),
          label: Text(l10n.copyInvite),
        ),
        TextButton(
          onPressed: () => context.go('/g/$groupId'),
          child: Text(l10n.toGroup),
        ),
      ],
    );
  }
}
