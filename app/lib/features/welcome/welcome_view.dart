import 'package:commandvibe/core/platform/invite_link_source.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// First screen without a session: organizer sign-in or paste an invite link.
class WelcomeView extends StatefulWidget {
  const WelcomeView({super.key});

  @override
  State<WelcomeView> createState() => _WelcomeViewState();
}

class _WelcomeViewState extends State<WelcomeView> {
  final _link = TextEditingController();
  bool _badLink = false;

  @override
  void dispose() {
    _link.dispose();
    super.dispose();
  }

  void _openLink() {
    final token = inviteTokenFrom(Uri.tryParse(_link.text.trim()) ?? Uri());
    if (token == null) {
      setState(() => _badLink = true);
      return;
    }
    context.go(Uri(path: '/join', queryParameters: {'t': token}).toString());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return GlassPage(
      children: [
        Text(
          l10n.welcomeTitle,
          style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        Text(l10n.welcomeBody),
        FilledButton(
          onPressed: () => context.go('/org/login'),
          child: Text(l10n.organizerSignIn),
        ),
        const Divider(),
        TextField(
          key: const Key('invite-link'),
          controller: _link,
          keyboardType: TextInputType.url,
          decoration: InputDecoration(labelText: l10n.haveInvite),
          onSubmitted: (_) => _openLink(),
        ),
        if (_badLink) FormMessage(l10n.inviteClosed),
        OutlinedButton(
          key: const Key('open-invite'),
          onPressed: _openLink,
          child: Text(l10n.joinAction),
        ),
      ],
    );
  }
}
