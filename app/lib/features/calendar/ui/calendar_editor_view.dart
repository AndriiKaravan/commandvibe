import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/calendar_editor_view_model.dart';
import 'package:commandvibe/features/calendar/ui/calendar_labels.dart';
import 'package:commandvibe/features/calendar/ui/catalog_picker_sheet.dart';
import 'package:commandvibe/features/calendar/ui/custom_task_sheet.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// Route shell of the organizer's calendar: wires the view model and the sheets.
class CalendarEditorView extends StatefulWidget {
  const CalendarEditorView({super.key, required this.groupId});

  final String groupId;

  @override
  State<CalendarEditorView> createState() => _CalendarEditorViewState();
}

class _CalendarEditorViewState extends State<CalendarEditorView> {
  CalendarEditorViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      _viewModel = CalendarEditorViewModel(
        ServicesScope.of(context).calendar,
        groupId: widget.groupId,
      );
      _viewModel!.load();
    }
  }

  Future<void> _pickTask(int day) async {
    final taskId = await showCatalogPicker(
      context,
      ServicesScope.of(context).calendar,
    );
    if (taskId != null) {
      await _viewModel!.chooseTask(day, taskId);
    }
  }

  Future<void> _writeOwn(int day) async {
    final task = await showCustomTaskSheet(context);
    if (task != null) {
      await _viewModel!.writeOwn(day, task);
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
        title: Text(l10n.calendarTitle),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: BackButton(
          onPressed: () => context.go('/g/${widget.groupId}'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: CalendarEditorBody(
              viewModel: _viewModel!,
              onPickTask: _pickTask,
              onWriteOwn: _writeOwn,
              onSetup: () => context.go('/g/${widget.groupId}/setup'),
            ),
          ),
        ),
      ),
    );
  }
}

/// The calendar list itself; the sheets that choose or write a task come from the caller.
class CalendarEditorBody extends StatelessWidget {
  const CalendarEditorBody({
    super.key,
    required this.viewModel,
    required this.onPickTask,
    required this.onWriteOwn,
    required this.onSetup,
  });

  final CalendarEditorViewModel viewModel;
  final void Function(int day) onPickTask;
  final void Function(int day) onWriteOwn;
  final VoidCallback onSetup;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        final calendar = viewModel.calendar;
        if (calendar == null) {
          return Center(
            child: viewModel.loadFailed
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    spacing: 12,
                    children: [
                      FormMessage(l10n.networkError),
                      FilledButton(
                        onPressed: viewModel.load,
                        child: Text(l10n.retry),
                      ),
                    ],
                  )
                : const CircularProgressIndicator(),
          );
        }
        if (calendar.game == null) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              spacing: 12,
              children: [
                Text(l10n.calendarNotSetUp),
                FilledButton(
                  key: const Key('set-up-game'),
                  onPressed: onSetup,
                  child: Text(l10n.setUpGame),
                ),
              ],
            ),
          );
        }
        final canChangeSettings = calendar.days.every((day) => day.isEditable);
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              if (canChangeSettings)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    key: const Key('change-settings'),
                    onPressed: onSetup,
                    icon: const Icon(Icons.tune),
                    label: Text(l10n.changeSettings),
                  ),
                ),
              if (viewModel.message != null)
                FormMessage(l10n.editorMessage(viewModel.message!)),
              for (final day in calendar.days)
                _DayTile(
                  day: day,
                  viewModel: viewModel,
                  onPickTask: onPickTask,
                  onWriteOwn: onWriteOwn,
                ),
            ],
          ),
        );
      },
    );
  }
}

class _DayTile extends StatelessWidget {
  const _DayTile({
    required this.day,
    required this.viewModel,
    required this.onPickTask,
    required this.onWriteOwn,
  });

  final CalendarDay day;
  final CalendarEditorViewModel viewModel;
  final void Function(int day) onPickTask;
  final void Function(int day) onWriteOwn;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final text = Theme.of(context).textTheme;
    final task = day.task;
    final busy = viewModel.isBusy;
    return GlassPanel(
      key: Key('day-${day.dayIndex}'),
      radius: 22,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 6,
        children: [
          Row(
            children: [
              Text(
                l10n.dayNumber(day.dayIndex + 1),
                style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(width: 8),
              Text(
                DateFormat.MMMEd(
                  locale.toString(),
                ).format(DateTime.parse(day.date)),
                style: text.labelMedium,
              ),
              const Spacer(),
              if (day.state == DayState.open)
                Chip(label: Text(l10n.dayOpenState)),
              if (day.state == DayState.picking)
                Chip(label: Text(l10n.dayPickingState)),
            ],
          ),
          if (task != null) ...[
            Text(
              task.title.forLanguage(locale.languageCode),
              style: text.titleMedium,
            ),
            Text(task.description.forLanguage(locale.languageCode)),
          ],
          if (day.isEditable)
            Wrap(
              spacing: 4,
              children: [
                TextButton.icon(
                  key: Key('other-${day.dayIndex}'),
                  onPressed: busy ? null : () => viewModel.other(day.dayIndex),
                  icon: const Icon(Icons.autorenew),
                  label: Text(l10n.otherTask),
                ),
                TextButton.icon(
                  key: Key('pick-${day.dayIndex}'),
                  onPressed: busy ? null : () => onPickTask(day.dayIndex),
                  icon: const Icon(Icons.search),
                  label: Text(l10n.pickTask),
                ),
                TextButton.icon(
                  key: Key('own-${day.dayIndex}'),
                  onPressed: busy ? null : () => onWriteOwn(day.dayIndex),
                  icon: const Icon(Icons.edit_outlined),
                  label: Text(l10n.ownTask),
                ),
                if (viewModel.canMoveUp(day.dayIndex))
                  IconButton(
                    key: Key('up-${day.dayIndex}'),
                    tooltip: l10n.moveDayUp,
                    onPressed: busy
                        ? null
                        : () => viewModel.moveUp(day.dayIndex),
                    icon: const Icon(Icons.arrow_upward),
                  ),
                if (viewModel.canMoveDown(day.dayIndex))
                  IconButton(
                    key: Key('down-${day.dayIndex}'),
                    tooltip: l10n.moveDayDown,
                    onPressed: busy
                        ? null
                        : () => viewModel.moveDown(day.dayIndex),
                    icon: const Icon(Icons.arrow_downward),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
