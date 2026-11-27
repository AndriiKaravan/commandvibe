import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/calendar_labels.dart';
import 'package:commandvibe/features/calendar/ui/game_setup_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// Route shell of the game setup: wires the view model and the platform pickers.
class GameSetupView extends StatefulWidget {
  const GameSetupView({super.key, required this.groupId});

  final String groupId;

  @override
  State<GameSetupView> createState() => _GameSetupViewState();
}

class _GameSetupViewState extends State<GameSetupView> {
  GameSetupViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _viewModel ??= GameSetupViewModel(
      ServicesScope.of(context).calendar,
      groupId: widget.groupId,
    )..addListener(_onChange);
  }

  void _onChange() {
    if (_viewModel!.saved != null && mounted) {
      context.go('/g/${widget.groupId}/calendar');
    }
  }

  Future<void> _pickDate() async {
    final viewModel = _viewModel!;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final picked = await showDatePicker(
      context: context,
      initialDate: viewModel.startDate.isBefore(today)
          ? today
          : viewModel.startDate,
      firstDate: today,
      lastDate: today.add(const Duration(days: 365)),
    );
    if (picked != null) {
      viewModel.setStartDate(picked);
    }
  }

  Future<void> _pickTime() async {
    final viewModel = _viewModel!;
    final parts = viewModel.openTime.split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.parse(parts[0]),
        minute: int.parse(parts[1]),
      ),
    );
    if (picked != null) {
      viewModel.setOpenTime(
        '${picked.hour.toString().padLeft(2, '0')}:'
        '${picked.minute.toString().padLeft(2, '0')}',
      );
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
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.gameSetupTitle),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: GameSetupBody(
              viewModel: _viewModel!,
              onPickDate: _pickDate,
              onPickTime: _pickTime,
            ),
          ),
        ),
      ),
    );
  }
}

/// The setup form itself; the date and time pickers are supplied by the caller.
class GameSetupBody extends StatelessWidget {
  const GameSetupBody({
    super.key,
    required this.viewModel,
    required this.onPickDate,
    required this.onPickTime,
  });

  final GameSetupViewModel viewModel;
  final VoidCallback onPickDate;
  final VoidCallback onPickTime;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final text = Theme.of(context).textTheme;
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        final shown = viewModel.error ?? viewModel.problem;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: GlassPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 16,
              children: [
                OutlinedButton.icon(
                  key: const Key('pick-date'),
                  onPressed: onPickDate,
                  icon: const Icon(Icons.event),
                  label: Text(
                    l10n.startDateLabel(
                      DateFormat.yMMMMd(locale).format(viewModel.startDate),
                    ),
                  ),
                ),
                Text(l10n.daysLabel(viewModel.days), style: text.titleSmall),
                Slider(
                  key: const Key('days-slider'),
                  min: GameSetupViewModel.minDays.toDouble(),
                  max: GameSetupViewModel.maxDays.toDouble(),
                  divisions:
                      GameSetupViewModel.maxDays - GameSetupViewModel.minDays,
                  value: viewModel.days
                      .clamp(
                        GameSetupViewModel.minDays,
                        GameSetupViewModel.maxDays,
                      )
                      .toDouble(),
                  onChanged: (value) => viewModel.setDays(value.round()),
                ),
                OutlinedButton.icon(
                  key: const Key('pick-time'),
                  onPressed: onPickTime,
                  icon: const Icon(Icons.schedule),
                  label: Text(l10n.openTimeLabel(viewModel.openTime)),
                ),
                Text(l10n.modeLabel, style: text.titleSmall),
                SegmentedButton<GameMode>(
                  segments: [
                    ButtonSegment(
                      value: GameMode.auto,
                      label: Text(l10n.modeAuto),
                    ),
                    ButtonSegment(
                      value: GameMode.roulette,
                      label: Text(l10n.modeRoulette),
                    ),
                  ],
                  selected: {viewModel.mode},
                  onSelectionChanged: (selection) =>
                      viewModel.setMode(selection.first),
                ),
                Text(l10n.categoriesLabel, style: text.titleSmall),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final category in GameCategory.values)
                      FilterChip(
                        key: Key('category-${category.name}'),
                        label: Text(l10n.category(category)),
                        selected: viewModel.categories.contains(category),
                        onSelected: (_) => viewModel.toggleCategory(category),
                      ),
                  ],
                ),
                if (shown != null) FormMessage(l10n.setupError(shown)),
                FilledButton(
                  key: const Key('save-game'),
                  onPressed: viewModel.canSubmit ? viewModel.submit : null,
                  child: Text(l10n.saveGame),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
