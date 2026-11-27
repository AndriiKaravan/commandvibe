import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/today/data/today_models.dart';
import 'package:commandvibe/features/today/ui/today_view_model.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ks_core/testing.dart';

import 'fake_today_repository.dart';

void main() {
  group('TodayViewModel', () {
    late FakeTodayRepository repository;
    late FakeRealtimeClient realtime;
    late TodayViewModel viewModel;
    // The phone's clock is 4 s ahead of the server's.
    var localNow = serverNow.add(const Duration(seconds: 4));

    TodayViewModel create() => TodayViewModel(
      repository,
      realtime,
      groupId: 'g1',
      clock: () => localNow,
      settle: Duration.zero,
    );

    setUp(() {
      localNow = serverNow.add(const Duration(seconds: 4));
      repository = FakeTodayRepository(aToday());
      realtime = FakeRealtimeClient();
      viewModel = create();
    });

    tearDown(() => viewModel.dispose());

    Future<void> start() async {
      viewModel.start();
      await pumpEventQueue();
    }

    test('should follow the group topic and load at once', () async {
      await start();
      expect(realtime.subscribedTopics, ['group:g1']);
      expect(repository.reads, 1);
    });

    test('should show the task of an open day', () async {
      await start();
      final state = viewModel.state as TodayOpen;
      expect(state.task?.title.uk, 'Сніговик');
    });

    test('should map each stage of the game', () async {
      repository.next = aToday(status: TodayStatus.notConfigured);
      await start();
      expect(viewModel.state, isA<TodayNotConfigured>());

      repository.next = aToday(
        status: TodayStatus.beforeStart,
        state: DayState.closed,
      );
      realtime.emit(eventOf('day.opened'));
      await pumpEventQueue();
      expect(viewModel.state, isA<TodayBeforeStart>());

      repository.next = aToday(status: TodayStatus.finished);
      realtime.emit(eventOf('game.finished'));
      await pumpEventQueue();
      expect(viewModel.state, isA<TodayFinished>());
    });

    test('should say whose turn it is to spin', () async {
      final deadline = DateTime.utc(2026, 12, 1, 10);
      repository.next = aToday(
        state: DayState.picking,
        pickerMemberId: 'm1',
        isMyTurn: true,
        pickDeadlineAt: deadline,
      );
      await start();
      final waiting = viewModel.state as TodayWaiting;
      expect(waiting.isMyTurn, isTrue);
      expect(waiting.pickerMemberId, 'm1');
      expect(waiting.deadline, deadline);
    });

    test('should not offer the spin to someone else', () async {
      repository.next = aToday(
        state: DayState.picking,
        pickerMemberId: 'm1',
        isMyTurn: false,
        pickDeadlineAt: DateTime.utc(2026, 12, 1, 10),
      );
      await start();
      expect((viewModel.state as TodayWaiting).isMyTurn, isFalse);
    });

    test('should start the wheel on a spin event, on the server clock', () async {
      repository.next = aToday(
        state: DayState.picking,
        pickerMemberId: 'm1',
        isMyTurn: false,
        pickDeadlineAt: DateTime.utc(2026, 12, 1, 10),
      );
      await start();
      repository.next = aToday(
        withTask: false,
        spin: aSpinAt(DateTime.utc(2026, 12, 1, 7, 0, 29)),
      );
      realtime.emit(eventOf('roulette.spin'));
      await pumpEventQueue();
      final state = viewModel.state as TodaySpinning;
      expect(state.motion.replay, isFalse);
      // The spin began 1 s ago on the server clock, whatever this phone's clock says.
      expect(state.motion.startOffset, const Duration(seconds: 1));
      expect(state.motion.doorCount, 7);
    });

    test('should show the task after the wheel has stopped', () async {
      repository.script = [
        aToday(
          withTask: false,
          spin: aSpinAt(DateTime.utc(2026, 12, 1, 7, 0, 29)),
        ),
        aToday(spin: aSpinAt(DateTime.utc(2026, 12, 1, 7, 0, 29))),
      ];
      await start();
      expect(viewModel.state, isA<TodaySpinning>());
      await viewModel.animationFinished();
      expect((viewModel.state as TodayOpen).task?.title.uk, 'Сніговик');
    });

    test('should ask again while the server still hides the task', () async {
      final spin = aSpinAt(DateTime.utc(2026, 12, 1, 7, 0, 29));
      repository.script = [
        aToday(withTask: false, spin: spin),
        aToday(withTask: false, spin: spin),
        aToday(spin: spin),
      ];
      await start();
      await viewModel.animationFinished();
      expect(repository.reads, 3);
      expect(viewModel.state, isA<TodayOpen>());
      expect((viewModel.state as TodayOpen).task, isNotNull);
    });

    test(
      'should replay a spin that ended before this phone opened the app',
      () async {
        repository.next = aToday(
          spin: aSpinAt(DateTime.utc(2026, 12, 1, 6, 0)),
        );
        await start();
        final state = viewModel.state as TodaySpinning;
        expect(state.motion.replay, isTrue);
        await viewModel.animationFinished();
        expect(viewModel.state, isA<TodayOpen>());
        await pumpEventQueue();
        // A later reload does not replay it again.
        realtime.emit(eventOf('day.opened'));
        await pumpEventQueue();
        expect(viewModel.state, isA<TodayOpen>());
      },
    );

    test('should spin through the repository and reload', () async {
      repository.next = aToday(
        state: DayState.picking,
        pickerMemberId: 'm1',
        isMyTurn: true,
        pickDeadlineAt: DateTime.utc(2026, 12, 1, 10),
      );
      await start();
      await viewModel.spin();
      expect(repository.spins, 1);
      expect(repository.reads, 2);
      expect(viewModel.message, isNull);
    });

    test('should explain a spin that the server refused and reload', () async {
      await start();
      repository.error = ApiException(409, code: 'not_picking');
      await viewModel.spin();
      expect(viewModel.message, TodayMessage.turnOver);
      repository.error = null;
      repository.error = ApiException(403, code: 'not_your_turn');
      await viewModel.spin();
      expect(viewModel.message, TodayMessage.turnOver);
    });

    test('should flag a failed load without losing the last state', () async {
      await start();
      repository.error = NetworkException('offline');
      realtime.emit(eventOf('day.opened'));
      await pumpEventQueue();
      expect(viewModel.loadFailed, isTrue);
      expect(viewModel.state, isA<TodayOpen>());
    });

    test('should reload on every group event', () async {
      await start();
      final reads = repository.reads;
      realtime.emit(eventOf('day.opened'));
      await pumpEventQueue();
      expect(repository.reads, reads + 1);
    });
  });
}
