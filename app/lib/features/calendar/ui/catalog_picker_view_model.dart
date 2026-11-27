import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/data/calendar_repository.dart';
import 'package:flutter/foundation.dart';

/// Search over the task catalog for the organizer's "choose a task" sheet.
class CatalogPickerViewModel extends ChangeNotifier {
  CatalogPickerViewModel(this._repository);

  final CalendarRepository _repository;

  List<TaskItem> _results = const [];
  GameCategory? _category;
  bool _loading = false;
  bool _failed = false;

  List<TaskItem> get results => _results;
  GameCategory? get category => _category;
  bool get isLoading => _loading;

  /// True when the last search could not reach the server; the old results stay.
  bool get failed => _failed;

  Future<void> search({GameCategory? category, String? query}) async {
    _category = category;
    _loading = true;
    notifyListeners();
    final text = query?.trim();
    try {
      _results = await _repository.catalog(
        category: category,
        query: text == null || text.isEmpty ? null : text,
      );
      _failed = false;
    } on Exception {
      _failed = true;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
