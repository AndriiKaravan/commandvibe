import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:flutter_test/flutter_test.dart';

final _base = Uri.parse('https://api.test/');

Map<String, Object?> _json({Object? likes, Object? commentCount}) => {
  'memberId': 'm1',
  'displayName': 'Олена',
  'submittedAt': '2026-12-02T08:00:00.000Z',
  'access': 'full',
  'photoUrl': '/p/photo',
  'blurUrl': '/p/blur',
  'width': 800,
  'height': 600,
  'mine': false,
  'likes': likes,
  'commentCount': commentCount,
};

void main() {
  group('SubmissionItem likes and comments', () {
    test(
      'should read who liked, whether the viewer did, and the comment count',
      () {
        final item = SubmissionItem.fromJson(
          _json(
            likes: {
              'count': 2,
              'mine': true,
              'by': [
                {'memberId': 'a', 'displayName': 'Anna', 'avatar': 'av03'},
                {'memberId': 'b', 'displayName': 'Boris'},
              ],
            },
            commentCount: 4,
          ),
          _base,
        );

        expect(item.likes.count, 2);
        expect(item.likes.mine, isTrue);
        expect(item.likes.by!.map((l) => l.displayName), ['Anna', 'Boris']);
        expect(item.likes.by!.first.avatar, 'av03');
        expect(item.likes.by!.last.avatar, isNull);
        expect(item.commentCount, 4);
      },
    );

    test('should read whether the viewer may like the photo', () {
      final yes = SubmissionItem.fromJson(
        _json(likes: {'count': 0, 'mine': false, 'canLike': true}),
        _base,
      );
      final no = SubmissionItem.fromJson(
        _json(likes: {'count': 0, 'mine': false, 'canLike': false}),
        _base,
      );
      final unknown = SubmissionItem.fromJson(
        _json(likes: {'count': 0, 'mine': false}),
        _base,
      );

      expect(yes.likes.canLike, isTrue);
      expect(no.likes.canLike, isFalse);
      expect(unknown.likes.canLike, isFalse);
    });

    test('should know only the count when the group hides the names', () {
      final item = SubmissionItem.fromJson(
        _json(likes: {'count': 3, 'mine': false}, commentCount: 0),
        _base,
      );

      expect(item.likes.count, 3);
      expect(item.likes.by, isNull);
      expect(item.likes.namesHidden, isTrue);
    });

    test(
      'should show names when the server sends them, even an empty list',
      () {
        final item = SubmissionItem.fromJson(
          _json(
            likes: {'count': 0, 'mine': false, 'by': const []},
            commentCount: 0,
          ),
          _base,
        );

        expect(item.likes.namesHidden, isFalse);
      },
    );

    test(
      'should fall back to no likes and no comments from an older server',
      () {
        final item = SubmissionItem.fromJson(_json(), _base);

        expect(item.likes.count, 0);
        expect(item.likes.mine, isFalse);
        expect(item.commentCount, 0);
      },
    );
  });
}
