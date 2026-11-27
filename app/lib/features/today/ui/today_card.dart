import 'dart:async';

import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/photos/ui/day_photos_section.dart';
import 'package:commandvibe/features/today/ui/roulette_motion.dart';
import 'package:commandvibe/features/today/ui/roulette_wheel.dart';
import 'package:commandvibe/features/today/ui/today_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// The "Today" card of the group home: wires the view model to the services.
class TodayCard extends StatefulWidget {
  const TodayCard({super.key, required this.groupId});

  final String groupId;

  @override
  State<TodayCard> createState() => _TodayCardState();
}

class _TodayCardState extends State<TodayCard> {
  TodayViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel = TodayViewModel(
        services.today,
        services.realtime,
        groupId: widget.groupId,
      )..start();
    }
  }

  @override
  void dispose() {
    _viewModel?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = _viewModel!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 16,
      children: [
        TodayCardBody(viewModel: viewModel),
        ListenableBuilder(
          listenable: viewModel,
          builder: (context, _) {
            final state = viewModel.state;
            // Photos belong to a day that is open and whose task the player can already read.
            if (state is TodayOpen && state.task != null) {
              return DayPhotosCard(
                key: ValueKey('photos-${state.dayIndex}'),
                groupId: widget.groupId,
                dayIndex: state.dayIndex,
              );
            }
            return const SizedBox.shrink();
          },
        ),
      ],
    );
  }
}

/// What the card shows for each stage of the day.
class TodayCardBody extends StatelessWidget {
  const TodayCardBody({super.key, required this.viewModel});

  final TodayViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) => GlassPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Text(l10n.todayTitle, style: text.labelLarge),
            _stage(context, viewModel.state),
            if (viewModel.message != null)
              FormMessage(
                viewModel.message == TodayMessage.turnOver
                    ? l10n.todayTurnOver
                    : l10n.genericError,
              ),
            if (viewModel.loadFailed) FormMessage(l10n.networkError),
          ],
        ),
      ),
    );
  }

  Widget _stage(BuildContext context, TodayState state) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final text = Theme.of(context).textTheme;
    return switch (state) {
      TodayLoading() => const Center(child: CircularProgressIndicator()),
      TodayNotConfigured() => Text(l10n.todayNotConfigured),
      TodayBeforeStart(:final opensAt) => Text(
        l10n.todayBeforeStart(
          DateFormat.MMMd(locale.toString()).add_Hm().format(opensAt.toLocal()),
        ),
      ),
      TodayWaiting(:final isMyTurn, :final deadline) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Text(
            isMyTurn ? l10n.todayWaitingMine : l10n.todayWaitingOther,
            style: text.titleMedium,
          ),
          if (deadline != null)
            Text(
              l10n.todaySpinUntil(
                DateFormat.Hm(locale.toString()).format(deadline.toLocal()),
              ),
            ),
          if (isMyTurn)
            FilledButton(
              key: const Key('spin-button'),
              onPressed: viewModel.spin,
              child: Text(l10n.todaySpin),
            ),
        ],
      ),
      TodaySpinning(:final dayIndex, :final motion, :final doors) => Column(
        spacing: 8,
        children: [
          SpinningWheel(
            key: ValueKey('wheel-$dayIndex'),
            motion: motion,
            doors: doors,
            onFinished: viewModel.animationFinished,
          ),
          Text(l10n.todaySpinning),
        ],
      ),
      TodayOpen(:final task) => _task(context, task),
      TodayFinished(:final task) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          if (task != null) _task(context, task),
          Text(l10n.todayFinished),
        ],
      ),
    };
  }

  Widget _task(BuildContext context, TaskItem? task) {
    final l10n = AppLocalizations.of(context);
    final language = Localizations.localeOf(context).languageCode;
    final text = Theme.of(context).textTheme;
    if (task == null) {
      return Text(l10n.todayLoadingTask);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 6,
      children: [
        Text(task.title.forLanguage(language), style: text.headlineSmall),
        Text(task.description.forLanguage(language)),
      ],
    );
  }
}

/// The turning wheel under a fixed pointer; plays [motion] and reports when it stops.
class SpinningWheel extends StatefulWidget {
  const SpinningWheel({
    super.key,
    required this.motion,
    required this.doors,
    required this.onFinished,
  });

  final RouletteMotion motion;
  final List<int> doors;
  final VoidCallback onFinished;

  @override
  State<SpinningWheel> createState() => _SpinningWheelState();
}

class _SpinningWheelState extends State<SpinningWheel>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  Timer? _delay;

  @override
  void initState() {
    super.initState();
    final motion = widget.motion;
    _controller = AnimationController(
      vsync: this,
      duration: motion.animationDuration,
      value:
          motion.startOffset.inMicroseconds /
          motion.animationDuration.inMicroseconds,
    )..addStatusListener(_onStatus);
    // A spin still ahead on the server's clock starts when that moment comes.
    if (motion.delay == Duration.zero) {
      _controller.forward();
    } else {
      _delay = Timer(motion.delay, _controller.forward);
    }
  }

  void _onStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed) {
      widget.onFinished();
    }
  }

  @override
  void dispose() {
    _delay?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final motion = widget.motion;
    return Stack(
      alignment: Alignment.topCenter,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 20),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) => RouletteWheel(
              doors: widget.doors,
              angle: rouletteAngle(
                elapsed: Duration(
                  microseconds:
                      (_controller.value *
                              motion.animationDuration.inMicroseconds)
                          .round(),
                ),
                duration: motion.animationDuration,
                doorCount: motion.doorCount,
                winnerIndex: motion.winnerIndex,
              ),
            ),
          ),
        ),
        Icon(
          Icons.arrow_drop_down,
          size: 48,
          color: Theme.of(context).colorScheme.onSurface,
        ),
      ],
    );
  }
}
