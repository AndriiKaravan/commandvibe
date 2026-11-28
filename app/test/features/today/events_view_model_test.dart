import 'package:commandvibe/features/today/ui/events_view_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

RealtimeEvent _event(
  String type,
  Map<String, Object?> data, {
  String topic = 'group:g1',
}) => RealtimeEvent(
  topic: topic,
  type: type,
  data: data,
  id: 'e-$type-${data.hashCode}',
  serverTime: DateTime.utc(2026, 12),
);

void main() {
  group('EventsViewModel', () {
    late FakeRealtimeClient realtime;
    late Map<String, String> names;
    late EventsViewModel viewModel;

    setUp(() {
      realtime = FakeRealtimeClient();
      names = {'m1': 'Олена'};
      viewModel = EventsViewModel(
        realtime,
        groupId: 'g1',
        nameOf: (id) => names[id],
        clock: () => DateTime.utc(2026, 12, 2, 10),
      )..start();
    });

    tearDown(() => viewModel.dispose());

    test('should start empty', () {
      expect(viewModel.events, isEmpty);
    });

    test('should note a new photo by a known member', () async {
      realtime.emit(
        _event('submission.created', {'dayIndex': 0, 'memberId': 'm1'}),
      );
      await pumpEventQueue();

      expect(viewModel.events, hasLength(1));
      expect(viewModel.events.single.kind, GameEventKind.photoSent);
      expect(viewModel.events.single.name, 'Олена');
    });

    test('should skip a photo by someone whose name is not known', () async {
      realtime.emit(
        _event('submission.created', {'dayIndex': 0, 'memberId': 'stranger'}),
      );
      await pumpEventQueue();

      expect(viewModel.events, isEmpty);
    });

    test('should note a day opening and a reveal with their days', () async {
      realtime.emit(_event('day.opened', {'dayIndex': 2}));
      realtime.emit(_event('photos.revealed', {'dayIndex': 0}));
      await pumpEventQueue();

      expect(viewModel.events.map((e) => (e.kind, e.dayIndex)), [
        (GameEventKind.photosRevealed, 0),
        (GameEventKind.dayOpened, 2),
      ]);
    });

    test('should ignore events it does not describe', () async {
      realtime.emit(_event('roulette.spin', {}));
      realtime.emit(
        _event('submission.hidden', {'dayIndex': 0, 'memberId': 'm1'}),
      );
      await pumpEventQueue();

      expect(viewModel.events, isEmpty);
    });

    test('should keep only the 20 newest events, newest first', () async {
      for (var day = 0; day < 25; day++) {
        realtime.emit(_event('day.opened', {'dayIndex': day}));
      }
      await pumpEventQueue();

      expect(viewModel.events, hasLength(20));
      expect(viewModel.events.first.dayIndex, 24);
      expect(viewModel.events.last.dayIndex, 5);
    });
  });
}
