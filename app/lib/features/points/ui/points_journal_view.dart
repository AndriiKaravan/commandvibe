import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/features/points/data/points_models.dart';
import 'package:commandvibe/features/points/ui/journal_groups.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// "Where my points come from", live.
class PointsJournalView extends StatefulWidget {
  const PointsJournalView({super.key, required this.groupId});

  final String groupId;

  @override
  State<PointsJournalView> createState() => _PointsJournalViewState();
}

class _PointsJournalViewState extends State<PointsJournalView> {
  LiveLoader<PointsJournal>? _loader;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loader == null) {
      final services = ServicesScope.of(context);
      _loader = LiveLoader<PointsJournal>(
        services.realtime,
        topic: 'group:${widget.groupId}',
        reloadOn: const {
          ...submissionEvents,
          ...membershipEvents,
          'day.opened',
          'game.finished',
        },
        load: () => services.points.journal(widget.groupId),
      )..start();
    }
  }

  @override
  void dispose() {
    _loader?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final loader = _loader!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.pointsJournalTitle),
        backgroundColor: Colors.transparent,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListenableBuilder(
              listenable: loader,
              builder: (context, _) {
                final journal = loader.value;
                if (journal == null) {
                  return loader.loadFailed
                      ? Center(child: Text(l10n.networkError))
                      : const Center(child: CircularProgressIndicator());
                }
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [PointsJournalList(journal: journal)],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// The journal as plain widgets: days, entries with their reason, and the total.
class PointsJournalList extends StatelessWidget {
  const PointsJournalList({super.key, required this.journal});

  final PointsJournal journal;

  static String _signed(int amount) => amount < 0 ? '−${-amount}' : '+$amount';

  static String _label(AppLocalizations l10n, PointEntry entry) =>
      switch (entry.kind) {
        PointKind.done => l10n.pointsKindDone,
        PointKind.speed => l10n.pointsKindSpeed(entry.detail ?? 0),
        PointKind.late => l10n.pointsKindLate(entry.detail ?? 0),
        PointKind.sympathy => l10n.pointsKindSympathy(entry.detail ?? 0),
        PointKind.goal => l10n.pointsKindGoal,
        PointKind.other => l10n.pointsKindOther,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    if (journal.entries.isEmpty) {
      return Center(child: Text(l10n.pointsJournalEmpty));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        for (final day in groupJournal(journal.entries))
          GlassPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 6,
              children: [
                Text(
                  l10n.daySheetTitle(day.dayIndex + 1),
                  style: text.titleSmall,
                ),
                for (final entry in day.entries)
                  Row(
                    children: [
                      Expanded(child: Text(_label(l10n, entry))),
                      Text(
                        _signed(entry.amount),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        Text(
          l10n.pointsTotal(journal.total),
          textAlign: TextAlign.end,
          style: text.titleMedium,
        ),
      ],
    );
  }
}
