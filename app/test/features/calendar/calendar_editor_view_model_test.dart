import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/calendar_editor_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_calendar_repository.dart';

void main() {
  group('CalendarEditorViewModel', () {
    late FakeCalendarRepository repository;
    late CalendarEditorViewModel viewModel;

    setUp(() async {
      repository = FakeCalendarRepository(aCalendar(open: {0}));
      viewModel = CalendarEditorViewModel(repository, groupId: 'g1');
      await viewModel.load();
    });

    test('should load the calendar', () {
      expect(viewModel.calendar?.days, hasLength(7));
      expect(viewModel.isLoading, isFalse);
      expect(viewModel.loadFailed, isFalse);
    });

    test('should report a failed load without losing the screen', () async {
      repository.error = NetworkException('offline');
      await viewModel.load();
      expect(viewModel.loadFailed, isTrue);
    });

    test('should replace only the day that asked for another task', () async {
      final before = viewModel.calendar!.days.map((d) => d.task?.id).toList();
      await viewModel.other(3);
      final after = viewModel.calendar!.days.map((d) => d.task?.id).toList();
      expect(after[3], 'other3');
      expect([...after]..removeAt(3), [...before]..removeAt(3));
    });

    test('should put a catalog or an own task on a day', () async {
      await viewModel.chooseTask(2, 'snowman');
      expect(viewModel.calendar!.days[2].task?.id, 'snowman');
      final (task, _) = CustomTask.tryCreate(
        title: 'Наш кіт',
        description: 'Кіт у кадрі',
      );
      await viewModel.writeOwn(4, task!);
      expect(viewModel.calendar!.days[4].task?.custom, isTrue);
      expect(repository.calls, contains('setCustomTask:4:Наш кіт'));
    });

    test('should move a day up or down only between editable days', () async {
      expect(viewModel.canMoveUp(1), isFalse, reason: 'day 0 is open');
      expect(viewModel.canMoveUp(2), isTrue);
      expect(viewModel.canMoveDown(2), isTrue);
      expect(viewModel.canMoveDown(6), isFalse, reason: 'last day');
      expect(viewModel.canMoveUp(0), isFalse);
      await viewModel.moveDown(2);
      await viewModel.moveUp(5);
      expect(repository.calls, containsAllInOrder(['move:2:3', 'move:5:4']));
    });

    test(
      'should say a day has opened and reload when the server refuses',
      () async {
        repository.error = ApiException(409, code: 'day_opened');
        await viewModel.other(1);
        expect(viewModel.message, EditorMessage.dayOpened);
        repository.error = null;
        expect(
          repository.calls.where((c) => c == 'calendar').length,
          greaterThanOrEqualTo(2),
          reason: 'the calendar is read again after the refusal',
        );
      },
    );

    test('should explain the other refusals', () async {
      repository.error = ApiException(409, code: 'no_more_tasks');
      await viewModel.other(1);
      expect(viewModel.message, EditorMessage.noMoreTasks);
      repository.error = ApiException(409, code: 'task_in_game');
      await viewModel.chooseTask(1, 'snowman');
      expect(viewModel.message, EditorMessage.taskInGame);
      repository.error = NetworkException('offline');
      await viewModel.other(1);
      expect(viewModel.message, EditorMessage.failed);
    });

    test('should clear the message on the next action', () async {
      repository.error = ApiException(409, code: 'no_more_tasks');
      await viewModel.other(1);
      repository.error = null;
      await viewModel.other(1);
      expect(viewModel.message, isNull);
    });
  });
}
