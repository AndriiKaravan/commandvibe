import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/join/ui/returning_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

class ReturningView extends StatefulWidget {
  const ReturningView({super.key, required this.token});

  final String token;

  @override
  State<ReturningView> createState() => _ReturningViewState();
}

class _ReturningViewState extends State<ReturningView> {
  final _name = TextEditingController();
  final _pin = TextEditingController();
  ReturningViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _viewModel ??= ReturningViewModel(
      ServicesScope.of(context).join,
      token: widget.token,
    )..addListener(_onChange);
  }

  void _onChange() {
    final member = _viewModel!.member;
    if (_viewModel!.status == ReturningStatus.signedIn &&
        member != null &&
        mounted) {
      ServicesScope.of(context).realtime.authChanged();
      context.go('/g/${member.groupId}');
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _pin.dispose();
    _viewModel?.dispose();
    super.dispose();
  }

  String? _message(AppLocalizations l10n, ReturningViewModel viewModel) =>
      switch (viewModel.status) {
        ReturningStatus.wrongPin => l10n.wrongPin(viewModel.attemptsLeft),
        ReturningStatus.locked => l10n.pinLocked(viewModel.lockedMinutes),
        ReturningStatus.noSuchLogin => l10n.noSuchLogin,
        ReturningStatus.invalidPin => l10n.pinInvalid,
        ReturningStatus.closed => l10n.inviteClosed,
        ReturningStatus.networkError => l10n.networkError,
        ReturningStatus.error => l10n.genericError,
        _ => null,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final viewModel = _viewModel!;
        final message = _message(l10n, viewModel);
        void submit() => viewModel.submit(_name.text, _pin.text);
        return GlassPage(
          title: l10n.returningTitle,
          children: [
            TextField(
              controller: _name,
              maxLength: 40,
              decoration: InputDecoration(labelText: l10n.yourNameLabel),
            ),
            TextField(
              controller: _pin,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 4,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(labelText: l10n.pinLabel),
              onSubmitted: (_) => submit(),
            ),
            ?(message == null ? null : FormMessage(message)),
            FilledButton(
              onPressed: viewModel.status == ReturningStatus.submitting
                  ? null
                  : submit,
              child: Text(l10n.returningAction),
            ),
          ],
        );
      },
    );
  }
}
