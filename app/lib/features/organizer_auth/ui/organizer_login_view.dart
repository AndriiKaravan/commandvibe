import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/organizer_auth/ui/organizer_login_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class OrganizerLoginView extends StatefulWidget {
  const OrganizerLoginView({super.key});

  @override
  State<OrganizerLoginView> createState() => _OrganizerLoginViewState();
}

class _OrganizerLoginViewState extends State<OrganizerLoginView> {
  OrganizerLoginViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      _viewModel = OrganizerLoginViewModel(
        ServicesScope.of(context).organizerAuth,
      )..addListener(_onChange);
      _viewModel!.resume();
    }
  }

  void _onChange() {
    if (_viewModel!.status == OrganizerLoginStatus.signedIn && mounted) {
      ServicesScope.of(context).realtime.authChanged();
      context.go('/org/groups');
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
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final status = _viewModel!.status;
        final busy =
            status == OrganizerLoginStatus.busy ||
            status == OrganizerLoginStatus.redirecting;
        return GlassPage(
          title: l10n.organizerSignIn,
          children: [
            FilledButton.icon(
              onPressed: busy ? null : _viewModel!.signIn,
              icon: const Icon(Icons.login),
              label: Text(l10n.signInWithGoogle),
            ),
            if (status == OrganizerLoginStatus.failed)
              FormMessage(l10n.signInFailed),
            FormMessage(l10n.openInBrowserHint, isError: false),
          ],
        );
      },
    );
  }
}
