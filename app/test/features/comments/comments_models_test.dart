import 'package:commandvibe/features/comments/data/comments_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CommentItem', () {
    test('should read a comment with who wrote it and who may delete it', () {
      final item = CommentItem.fromJson({
        'id': 'c1',
        'memberId': 'm1',
        'displayName': 'Олена',
        'avatar': 'av02',
        'text': 'Гарно!',
        'createdAt': '2026-12-02T08:00:00.000Z',
        'mine': true,
        'canDelete': true,
      });

      expect(item.id, 'c1');
      expect(item.text, 'Гарно!');
      expect(item.avatar, 'av02');
      expect(item.createdAt, DateTime.utc(2026, 12, 2, 8));
      expect(item.mine, isTrue);
      expect(item.canDelete, isTrue);
    });

    test('should accept a comment without an avatar', () {
      final item = CommentItem.fromJson({
        'id': 'c2',
        'memberId': 'm2',
        'displayName': 'Taras',
        'text': 'ok',
        'createdAt': '2026-12-02T08:00:00.000Z',
        'mine': false,
        'canDelete': false,
      });

      expect(item.avatar, isNull);
      expect(item.canDelete, isFalse);
    });
  });
}
