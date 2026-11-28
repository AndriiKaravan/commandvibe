import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('event sets', () {
    test(
      'should keep likes and comments out of the events that change who did what',
      () {
        expect(
          submissionEvents,
          containsAll(const ['submission.created', 'photos.revealed']),
        );
        expect(submissionEvents, isNot(contains('like.changed')));
        expect(submissionEvents, isNot(contains('comment.created')));
        expect(submissionEvents, isNot(contains('comment.deleted')));
      },
    );

    test('should name the like and comment events on their own', () {
      expect(likeEvents, {'like.changed'});
      expect(commentEvents, {'comment.created', 'comment.deleted'});
    });

    test(
      'should give a photo list every event that can change what it shows',
      () {
        expect(photoListEvents, containsAll(submissionEvents));
        expect(photoListEvents, containsAll(likeEvents));
        expect(photoListEvents, containsAll(commentEvents));
      },
    );
  });
}
