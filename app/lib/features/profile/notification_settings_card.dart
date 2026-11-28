import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/profile/notification_settings_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// Push permission and the two switches for what a member wants to hear about.
class NotificationSettingsCard extends StatelessWidget {
  const NotificationSettingsCard({super.key, required this.model});

  final NotificationSettingsViewModel model;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) => GlassPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            Text(
              l10n.notifSettingsTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            _PushRow(model: model, l10n: l10n),
            if (model.playing) ...[
              SwitchListTile(
                key: const Key('notify-tasks'),
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.notifSettingsTasks),
                value: model.tasks,
                onChanged: model.setTasks,
              ),
              SwitchListTile(
                key: const Key('notify-social'),
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.notifSettingsSocial),
                value: model.social,
                onChanged: model.setSocial,
              ),
            ],
            if (model.failed)
              Text(
                l10n.notifSettingsFailed,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      ),
    );
  }
}

class _PushRow extends StatelessWidget {
  const _PushRow({required this.model, required this.l10n});

  final NotificationSettingsViewModel model;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) => switch (model.pushState) {
    PushState.unknown => const SizedBox.shrink(),
    PushState.on => Text(l10n.notifPushOn),
    PushState.off => Row(
      children: [
        Expanded(child: Text(l10n.notifPushOff)),
        FilledButton(
          key: const Key('enable-push'),
          onPressed: model.enablePush,
          child: Text(l10n.notifPushEnable),
        ),
      ],
    ),
    PushState.denied => Text(l10n.notifPushDenied),
    PushState.unsupported => Text(l10n.notifPushUnsupported),
    PushState.needsHomeScreen => Text(l10n.notifPushHomeScreen),
    PushState.notConfigured => Text(l10n.notifPushNotConfigured),
  };
}
