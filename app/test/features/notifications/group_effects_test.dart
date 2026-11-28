import 'package:commandvibe/features/notifications/ui/group_effects.dart';
import 'package:commandvibe/features/notifications/ui/live_effects.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

const _today = 0;
const _feed = 2;

RealtimeEvent _event(String type, [Map<String, Object?> data = const {}]) =>
    RealtimeEvent(
      topic: 'group:g1',
      type: type,
      data: data,
      id: 'e-$type',
      serverTime: DateTime.utc(2026, 12),
    );

void main() {
  group('liveEffectOf', () {
    test('should announce a new day with a toast and a dot on Today', () {
      final effect = liveEffectOf('day.opened', const {
        'dayIndex': 1,
      }, selfMemberId: 'me');

      expect(effect?.toast, LiveToast.dayOpened);
      expect(effect?.dotTab, _today);
    });

    test('should tell only the picker that it is their turn', () {
      const data = {'pickerMemberId': 'me'};
      expect(
        liveEffectOf('roulette.waiting', data, selfMemberId: 'me')?.toast,
        LiveToast.myTurn,
      );
      expect(
        liveEffectOf('roulette.waiting', data, selfMemberId: 'other'),
        isNull,
      );
    });

    test(
      'should put a dot on Feed for other people’s photos but not my own',
      () {
        expect(
          liveEffectOf('submission.created', const {
            'memberId': 'x',
          }, selfMemberId: 'me')?.dotTab,
          _feed,
        );
        expect(
          liveEffectOf('submission.replaced', const {
            'memberId': 'me',
          }, selfMemberId: 'me'),
          isNull,
        );
      },
    );

    test('should toast a comment on my photo, never one I wrote myself', () {
      expect(
        liveEffectOf('comment.created', const {
          'memberId': 'me',
          'by': 'x',
        }, selfMemberId: 'me')?.toast,
        LiveToast.comment,
      );
      expect(
        liveEffectOf('comment.created', const {
          'memberId': 'me',
          'by': 'me',
        }, selfMemberId: 'me'),
        isNull,
      );
      expect(
        liveEffectOf('comment.created', const {
          'memberId': 'x',
          'by': 'y',
        }, selfMemberId: 'me'),
        isNull,
      );
    });

    test('should ignore events that are not news for a person', () {
      expect(
        liveEffectOf('like.changed', const {}, selfMemberId: 'me'),
        isNull,
      );
      expect(
        liveEffectOf('member.joined', const {}, selfMemberId: 'me'),
        isNull,
      );
    });
  });

  group('GroupEffects', () {
    late FakeRealtimeClient realtime;
    late int current;
    late List<LiveToast> toasts;
    late GroupEffects effects;

    setUp(() {
      realtime = FakeRealtimeClient();
      current = 1;
      toasts = [];
      effects = GroupEffects(
        realtime,
        groupId: 'g1',
        selfMemberId: 'me',
        currentTab: () => current,
        onToast: toasts.add,
      )..start();
    });

    tearDown(() => effects.dispose());

    test('should light a tab and clear it when the tab is opened', () async {
      realtime.emit(_event('submission.created', {'memberId': 'x'}));
      await pumpEventQueue();
      expect(effects.dots, {_feed});

      effects.select(_feed);
      expect(effects.dots, isEmpty);
    });

    test('should not light the tab the person is already on', () async {
      current = _feed;
      realtime.emit(_event('submission.created', {'memberId': 'x'}));
      await pumpEventQueue();

      expect(effects.dots, isEmpty);
    });

    test('should hand toasts to the screen', () async {
      realtime.emit(_event('day.opened', {'dayIndex': 2}));
      await pumpEventQueue();

      expect(toasts, [LiveToast.dayOpened]);
    });

    test('should stay quiet after being disposed', () async {
      effects.dispose();
      realtime.emit(_event('day.opened', {'dayIndex': 2}));
      await pumpEventQueue();

      expect(toasts, isEmpty);
    });
  });
}
