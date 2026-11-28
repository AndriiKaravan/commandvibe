import 'package:commandvibe/features/feed/data/feed_models.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:flutter_test/flutter_test.dart';

final _base = Uri.parse('https://api.test/');

Map<String, Object?> _json({
  String access = 'full',
  bool withPhoto = true,
  Object? avatar,
}) => {
  'memberId': 'm1',
  'displayName': 'Олена',
  'avatar': avatar,
  'submittedAt': '2026-12-02T08:00:00.000Z',
  'access': access,
  if (withPhoto) 'photoUrl': '/p/photo-token',
  'blurUrl': '/p/blur-token',
  'width': 800,
  'height': 600,
  'mine': false,
  'dayIndex': 1,
  'taskTitle': {'uk': 'Ялинка', 'en': 'Tree'},
  'revealAt': '2026-12-03T07:00:00.000Z',
};

void main() {
  group('FeedItem', () {
    test('should read the photo together with its day and task', () {
      final item = FeedItem.fromJson(_json(avatar: 'av02'), _base);

      expect(item.dayIndex, 1);
      expect(item.taskTitle.forLanguage('en'), 'Tree');
      expect(item.revealAt, DateTime.utc(2026, 12, 3, 7));
      expect(item.photo.avatar, 'av02');
      expect(item.photo.access, PhotoAccess.full);
      expect(item.photo.photoUrl, Uri.parse('https://api.test/p/photo-token'));
    });

    test('should not invent a photo link for a blurred item', () {
      final item = FeedItem.fromJson(
        _json(access: 'blur', withPhoto: false),
        _base,
      );

      expect(item.photo.access, PhotoAccess.blur);
      expect(item.photo.photoUrl, isNull);
      expect(item.photo.blurUrl, Uri.parse('https://api.test/p/blur-token'));
    });

    test('should identify an item by day and author', () {
      expect(FeedItem.fromJson(_json(), _base).key, '1/m1');
    });
  });

  group('FeedPage', () {
    test('should carry the cursor of the next page', () {
      final page = FeedPage.fromJson({
        'items': [_json()],
        'next': 'cursor-1',
      }, _base);

      expect(page.items, hasLength(1));
      expect(page.next, 'cursor-1');
    });

    test('should have no cursor on the last page', () {
      final page = FeedPage.fromJson({'items': const []}, _base);

      expect(page.next, isNull);
    });
  });

  group('FeedFilter', () {
    test('should compare by value', () {
      expect(
        const FeedFilter(day: 1, mine: true),
        const FeedFilter(day: 1, mine: true),
      );
      expect(const FeedFilter(day: 1), isNot(const FeedFilter(day: 2)));
    });

    test('should know when nothing is filtered', () {
      expect(const FeedFilter().isEmpty, isTrue);
      expect(const FeedFilter(memberId: 'm1').isEmpty, isFalse);
    });
  });
}
