import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/catalog_picker_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_calendar_repository.dart';

void main() {
  group('CatalogPickerViewModel', () {
    late FakeCalendarRepository repository;
    late CatalogPickerViewModel viewModel;

    setUp(() {
      repository = FakeCalendarRepository(aCalendar())
        ..catalogResults = [aTask('a'), aTask('b')];
      viewModel = CatalogPickerViewModel(repository);
    });

    test('should load everything first', () async {
      await viewModel.search();
      expect(viewModel.results.map((t) => t.id), ['a', 'b']);
      expect(repository.calls, ['catalog:null:null']);
    });

    test('should pass the category and a trimmed query', () async {
      await viewModel.search(category: GameCategory.kids, query: '  кіт ');
      expect(repository.calls.last, 'catalog:kids:кіт');
      expect(viewModel.category, GameCategory.kids);
    });

    test('should send no query for blank text', () async {
      await viewModel.search(query: '   ');
      expect(repository.calls.last, 'catalog:null:null');
    });

    test('should keep the old results and flag a failed search', () async {
      await viewModel.search();
      repository.error = Exception('offline');
      await viewModel.search(query: 'x');
      expect(viewModel.failed, isTrue);
      expect(viewModel.results, hasLength(2));
    });
  });
}
