import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/data/calendar_repository.dart';
import 'package:commandvibe/features/calendar/ui/calendar_labels.dart';
import 'package:commandvibe/features/calendar/ui/catalog_picker_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// Lets the organizer search the catalog; returns the chosen task's id.
Future<String?> showCatalogPicker(
  BuildContext context,
  CalendarRepository repository,
) => showModalBottomSheet<String>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (_) =>
      CatalogPickerSheet(viewModel: CatalogPickerViewModel(repository)),
);

class CatalogPickerSheet extends StatefulWidget {
  const CatalogPickerSheet({super.key, required this.viewModel});

  final CatalogPickerViewModel viewModel;

  @override
  State<CatalogPickerSheet> createState() => _CatalogPickerSheetState();
}

class _CatalogPickerSheetState extends State<CatalogPickerSheet> {
  final _query = TextEditingController();

  @override
  void initState() {
    super.initState();
    widget.viewModel.search();
  }

  void _search({GameCategory? category}) =>
      widget.viewModel.search(category: category, query: _query.text);

  @override
  void dispose() {
    _query.dispose();
    widget.viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final language = Localizations.localeOf(context).languageCode;
    final viewModel = widget.viewModel;
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.8,
        child: ListenableBuilder(
          listenable: viewModel,
          builder: (context, _) => Padding(
            padding: EdgeInsets.fromLTRB(
              16,
              0,
              16,
              MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              children: [
                TextField(
                  controller: _query,
                  decoration: InputDecoration(
                    hintText: l10n.catalogSearchHint,
                    prefixIcon: const Icon(Icons.search),
                  ),
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _search(category: viewModel.category),
                ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: Text(l10n.catalogAllCategories),
                        selected: viewModel.category == null,
                        onSelected: (_) => _search(),
                      ),
                      for (final category in GameCategory.values)
                        ChoiceChip(
                          label: Text(l10n.category(category)),
                          selected: viewModel.category == category,
                          onSelected: (_) => _search(category: category),
                        ),
                    ],
                  ),
                ),
                if (viewModel.failed) Text(l10n.networkError),
                Expanded(
                  child: viewModel.results.isEmpty && !viewModel.isLoading
                      ? Center(child: Text(l10n.catalogNothingFound))
                      : ListView.builder(
                          itemCount: viewModel.results.length,
                          itemBuilder: (context, index) {
                            final task = viewModel.results[index];
                            return ListTile(
                              title: Text(task.title.forLanguage(language)),
                              subtitle: Text(
                                task.description.forLanguage(language),
                              ),
                              onTap: () => Navigator.of(context).pop(task.id),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
