import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/today/ui/events_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// The latest happenings of this session; hidden until there is one.
class EventsCard extends StatelessWidget {
  const EventsCard({super.key, required this.viewModel});

  final EventsViewModel viewModel;

  static const _shown = 5;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: viewModel,
    builder: (context, _) {
      final events = viewModel.events.take(_shown).toList();
      if (events.isEmpty) {
        return const SizedBox.shrink();
      }
      final l10n = AppLocalizations.of(context);
      return GlassPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            Text(
              l10n.eventsTitle,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            for (final event in events) Text(_describe(l10n, event)),
          ],
        ),
      );
    },
  );

  String _describe(AppLocalizations l10n, GameEvent event) {
    final day = (event.dayIndex ?? 0) + 1;
    return switch (event.kind) {
      GameEventKind.photoSent => l10n.eventPhotoSent(event.name ?? ''),
      GameEventKind.dayOpened => l10n.eventDayOpened(day),
      GameEventKind.photosRevealed => l10n.eventPhotosRevealed(day),
    };
  }
}
