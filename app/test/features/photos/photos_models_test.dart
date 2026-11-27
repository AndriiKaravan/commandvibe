import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:flutter_test/flutter_test.dart';

final _base = Uri.parse('https://api.test');

Map<String, dynamic> _item({bool full = false, Object? moderation}) => {
  'memberId': 'm1',
  'displayName': 'Ira',
  'submittedAt': '2026-12-01T08:00:00.000Z',
  'access': full ? 'full' : 'blur',
  if (full) 'photoUrl': '/p/photo-token',
  'blurUrl': '/p/blur-token',
  'width': 1600,
  'height': 1200,
  'mine': false,
  'moderation': ?moderation,
};

void main() {
  group('SubmissionItem', () {
    test('should have no photo url when the photo is blurred', () {
      final item = SubmissionItem.fromJson(_item(), _base);
      expect(item.access, PhotoAccess.blur);
      expect(item.photoUrl, isNull);
      expect(item.blurUrl, Uri.parse('https://api.test/p/blur-token'));
    });

    test('should resolve relative links against the server address', () {
      final item = SubmissionItem.fromJson(_item(full: true), _base);
      expect(item.access, PhotoAccess.full);
      expect(item.photoUrl, Uri.parse('https://api.test/p/photo-token'));
    });

    test('should read moderation data only when the server sent it', () {
      expect(SubmissionItem.fromJson(_item(), _base).moderation, isNull);
      final item = SubmissionItem.fromJson(
        _item(
          moderation: {
            'takenBefore': true,
            'takenAt': '2026-12-01T06:00:00.000Z',
            'source': 'gallery',
            'openComplaints': 2,
          },
        ),
        _base,
      );
      expect(item.moderation?.takenBefore, isTrue);
      expect(item.moderation?.source, 'gallery');
      expect(item.moderation?.openComplaints, 2);
    });
  });

  group('DaySubmissions', () {
    test('should separate my photo from the others', () {
      final day = DaySubmissions.fromJson({
        'dayIndex': 0,
        'revealAt': '2026-12-03T07:00:00.000Z',
        'revealed': false,
        'canSubmit': false,
        'mine': {..._item(full: true), 'mine': true, 'version': 'v1'},
        'items': [_item()],
        'total': 2,
        'serverTime': '2026-12-01T09:00:00.000Z',
      }, _base);
      expect(day.mine?.version, 'v1');
      expect(day.items, hasLength(1));
      expect(day.revealAt, DateTime.utc(2026, 12, 3, 7));
      expect(day.total, 2);
    });
  });

  group('ComplaintItem', () {
    test('should read reasons and complainers', () {
      final item = ComplaintItem.fromJson({
        'dayIndex': 1,
        'memberId': 'm1',
        'displayName': 'Ira',
        'reasons': {'inappropriate': 1, 'not_task': 0, 'other': 2},
        'complainers': [
          {'memberId': 'm2', 'displayName': 'Taras'},
        ],
        'firstAt': '2026-12-02T08:00:00.000Z',
        'hidden': false,
      });
      expect(item.reasons[ComplaintReason.other], 2);
      expect(item.complainers.single.displayName, 'Taras');
      expect(item.count, 3);
    });
  });
}
