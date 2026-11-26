import 'package:commandvibe/core/platform/invite_link_source.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('inviteTokenFrom', () {
    test('should read the token of a web join link', () {
      expect(
        inviteTokenFrom(
          Uri.parse(
            'https://commandvibe.karavanstudio.dev/join?t=abcDEF_123-xyz7890ABCD',
          ),
        ),
        'abcDEF_123-xyz7890ABCD',
      );
    });

    test('should read the token of an app link to the invite page', () {
      expect(
        inviteTokenFrom(
          Uri.parse(
            'https://commandvibe.karavanstudio.dev/j/abcDEF_123-xyz7890ABCD',
          ),
        ),
        'abcDEF_123-xyz7890ABCD',
      );
    });

    test('should ignore other links and malformed tokens', () {
      expect(
        inviteTokenFrom(Uri.parse('https://commandvibe.karavanstudio.dev/')),
        isNull,
      );
      expect(
        inviteTokenFrom(
          Uri.parse('https://commandvibe.karavanstudio.dev/join?t='),
        ),
        isNull,
      );
      expect(
        inviteTokenFrom(
          Uri.parse('https://commandvibe.karavanstudio.dev/j/has%20space'),
        ),
        isNull,
      );
      expect(
        inviteTokenFrom(
          Uri.parse('https://evil.example/j/abcDEF_123-xyz7890ABCD'),
        ),
        isNull,
      );
    });
  });
}
