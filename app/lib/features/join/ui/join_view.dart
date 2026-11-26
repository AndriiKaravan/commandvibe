import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/join/ui/join_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Opened from the invite link: group name, then "your name" — in the game within seconds.
class JoinView extends StatefulWidget {
  const JoinView({super.key, required this.token});

  final String token;

  @override
  State<JoinView> createState() => _JoinViewState();
}

class _JoinViewState extends State<JoinView> {
  final _name = TextEditingController();
  JoinViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel = JoinViewModel(
        services.join,
        token: widget.token,
        isOrganizerSignedIn: () async =>
            (await services.sessions.read())?.isOrganizer ?? false,
      )..addListener(_onChange);
      _viewModel!.load();
    }
  }

  void _onChange() {
    final member = _viewModel!.member;
    final status = _viewModel!.status;
    if (member != null &&
        (status == JoinStatus.joined || status == JoinStatus.pending) &&
        mounted) {
      ServicesScope.of(context).realtime.authChanged();
      context.go(
        status == JoinStatus.joined
            ? '/pin?g=${member.groupId}'
            : '/waiting?m=${member.id}&g=${member.groupId}',
      );
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _viewModel?.dispose();
    super.dispose();
  }

  String? _message(AppLocalizations l10n, JoinStatus status) =>
      switch (status) {
        JoinStatus.nameTaken => l10n.nameTaken,
        JoinStatus.invalidName => l10n.invalidName,
        JoinStatus.closed => l10n.inviteClosed,
        JoinStatus.full => l10n.groupFull,
        JoinStatus.networkError => l10n.networkError,
        JoinStatus.error => l10n.genericError,
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final viewModel = _viewModel!;
        final status = viewModel.status;
        if (status == JoinStatus.loading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final message = _message(l10n, status);
        if (status == JoinStatus.closed) {
          return GlassPage(children: [FormMessage(message!)]);
        }
        if (status == JoinStatus.organizerSignedIn) {
          return GlassPage(
            children: [
              Text(
                l10n.joinTitle(viewModel.groupName),
                style: text.headlineSmall,
              ),
              FormMessage(l10n.organizerOwnLink, isError: false),
              FilledButton(
                onPressed: () async {
                  final session = await ServicesScope.of(
                    context,
                  ).sessions.read();
                  if (context.mounted) {
                    context.go(
                      session?.groupId == null
                          ? '/org/new'
                          : '/g/${session!.groupId}',
                    );
                  }
                },
                child: Text(l10n.toGroup),
              ),
            ],
          );
        }
        return GlassPage(
          children: [
            Text(
              l10n.joinTitle(viewModel.groupName),
              style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            Text(l10n.joinMembers(viewModel.memberCount)),
            TextField(
              key: const Key('join-name'),
              controller: _name,
              maxLength: 40,
              autofocus: true,
              textInputAction: TextInputAction.go,
              decoration: InputDecoration(labelText: l10n.yourNameLabel),
              onSubmitted: viewModel.submit,
            ),
            ?(message == null ? null : FormMessage(message)),
            FilledButton(
              key: const Key('join-submit'),
              onPressed: status == JoinStatus.submitting
                  ? null
                  : () => viewModel.submit(_name.text),
              child: Text(l10n.joinAction),
            ),
            TextButton(
              onPressed: () => context.go(
                Uri(
                  path: '/join/returning',
                  queryParameters: {'t': widget.token},
                ).toString(),
              ),
              child: Text(l10n.alreadyPlaying),
            ),
          ],
        );
      },
    );
  }
}
