import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Calendar', () {
    test('should read a day without a task when the server hides it', () {
      final calendar = Calendar.fromJson({
        'game': {
          'startDate': '2026-12-01',
          'days': 7,
          'openTime': '09:00',
          'mode': 'roulette',
          'categories': ['home', 'kids'],
        },
        'days': [
          {
            'dayIndex': 0,
            'date': '2026-12-01',
            'opensAt': '2026-12-01T07:00:00.000Z',
            'state': 'open',
            'task': {
              'id': 'snowman',
              'title': {'uk': 'Сніговик', 'en': 'Snowman'},
              'description': {'uk': 'Опис'},
              'categories': ['winter', 'kids'],
              'custom': false,
            },
          },
          {
            'dayIndex': 1,
            'date': '2026-12-02',
            'opensAt': '2026-12-02T07:00:00.000Z',
            'state': 'closed',
          },
        ],
        'serverTime': '2026-12-01T07:00:01.000Z',
      });
      expect(calendar.game?.mode, GameMode.roulette);
      expect(calendar.game?.categories, [GameCategory.home, GameCategory.kids]);
      expect(calendar.days[0].state, DayState.open);
      expect(calendar.days[0].task?.id, 'snowman');
      expect(calendar.days[0].task?.categories, [
        GameCategory.winter,
        GameCategory.kids,
      ]);
      expect(calendar.days[1].task, isNull);
      expect(calendar.days[1].isEditable, isTrue);
      expect(calendar.days[0].isEditable, isFalse);
      expect(calendar.serverTime, DateTime.utc(2026, 12, 1, 7, 0, 1));
    });

    test('should read an empty calendar before the game is set up', () {
      final calendar = Calendar.fromJson({
        'days': <Object>[],
        'serverTime': '2026-12-01T07:00:00.000Z',
      });
      expect(calendar.game, isNull);
      expect(calendar.days, isEmpty);
    });
  });

  group('TaskText', () {
    test('should fall back to Ukrainian when there is no English text', () {
      const both = TaskText(uk: 'Кіт', en: 'Cat');
      const onlyUk = TaskText(uk: 'Кіт');
      expect(both.forLanguage('en'), 'Cat');
      expect(both.forLanguage('uk'), 'Кіт');
      expect(onlyUk.forLanguage('en'), 'Кіт');
    });
  });

  group('GameSetup', () {
    test('should serialize the date without a time part', () {
      final setup = GameSetup(
        startDate: DateTime(2026, 12, 1, 15, 30),
        days: 14,
        openTime: '09:00',
        mode: GameMode.auto,
        categories: const {GameCategory.home, GameCategory.pair},
      );
      expect(setup.toJson(), {
        'startDate': '2026-12-01',
        'days': 14,
        'openTime': '09:00',
        'mode': 'auto',
        'categories': ['home', 'pair'],
      });
    });
  });

  group('CustomTask', () {
    test('should trim, keep optional English and serialize for the server', () {
      final (task, error) = CustomTask.tryCreate(
        title: ' Наш кіт ',
        description: 'Кіт у кадрі',
        titleEn: ' ',
        descriptionEn: 'A cat',
      );
      expect(error, isNull);
      expect(task?.toJson(), {
        'custom': {
          'title': {'uk': 'Наш кіт'},
          'description': {'uk': 'Кіт у кадрі', 'en': 'A cat'},
        },
      });
    });

    test('should explain what is wrong', () {
      CustomTaskError? errorOf(String title, String description) =>
          CustomTask.tryCreate(title: title, description: description).$2;
      expect(errorOf('', 'x'), CustomTaskError.titleRequired);
      expect(errorOf('x' * 61, 'x'), CustomTaskError.titleTooLong);
      expect(errorOf('x', ' '), CustomTaskError.descriptionRequired);
      expect(errorOf('x', 'x' * 221), CustomTaskError.descriptionTooLong);
      expect(errorOf('x' * 60, 'x' * 220), isNull);
    });
  });
}
