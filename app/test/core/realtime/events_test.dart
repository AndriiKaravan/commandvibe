import 'package:commandvibe/core/realtime/live_loader.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('submissionEvents', () {
    test('should include what changes who sees or scores what', () {
      expect(
        submissionEvents,
        containsAll(const [
          'submission.created',
          'photos.revealed',
          'like.changed',
          'comment.created',
          'comment.deleted',
        ]),
      );
    });
  });
}
