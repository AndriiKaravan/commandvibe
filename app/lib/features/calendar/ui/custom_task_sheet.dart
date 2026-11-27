import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// Lets the organizer write their own task; returns it once it passes the server's limits.
Future<CustomTask?> showCustomTaskSheet(BuildContext context) =>
    showModalBottomSheet<CustomTask>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const CustomTaskSheet(),
    );

class CustomTaskSheet extends StatefulWidget {
  const CustomTaskSheet({super.key});

  @override
  State<CustomTaskSheet> createState() => _CustomTaskSheetState();
}

class _CustomTaskSheetState extends State<CustomTaskSheet> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _titleEn = TextEditingController();
  final _descriptionEn = TextEditingController();
  CustomTaskError? _error;

  void _save() {
    final (task, error) = CustomTask.tryCreate(
      title: _title.text,
      description: _description.text,
      titleEn: _titleEn.text,
      descriptionEn: _descriptionEn.text,
    );
    if (task != null) {
      Navigator.of(context).pop(task);
    } else {
      setState(() => _error = error);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _titleEn.dispose();
    _descriptionEn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final error = _error;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Text(
              l10n.ownTaskTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            TextField(
              key: const Key('own-title'),
              controller: _title,
              maxLength: CustomTask.maxTitle,
              decoration: InputDecoration(labelText: l10n.ownTaskNameLabel),
            ),
            TextField(
              key: const Key('own-description'),
              controller: _description,
              maxLength: CustomTask.maxDescription,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: l10n.ownTaskDescriptionLabel,
              ),
            ),
            TextField(
              controller: _titleEn,
              maxLength: CustomTask.maxTitle,
              decoration: InputDecoration(labelText: l10n.ownTaskNameEnLabel),
            ),
            TextField(
              controller: _descriptionEn,
              maxLength: CustomTask.maxDescription,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: l10n.ownTaskDescriptionEnLabel,
              ),
            ),
            if (error == CustomTaskError.titleRequired ||
                error == CustomTaskError.titleTooLong)
              FormMessage(l10n.ownTaskNameInvalid),
            if (error == CustomTaskError.descriptionRequired ||
                error == CustomTaskError.descriptionTooLong)
              FormMessage(l10n.ownTaskDescriptionInvalid),
            FilledButton(
              key: const Key('own-save'),
              onPressed: _save,
              child: Text(l10n.saveTask),
            ),
          ],
        ),
      ),
    );
  }
}
