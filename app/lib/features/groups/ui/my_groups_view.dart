import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/groups/ui/my_groups_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Where an organizer lands after signing in: their groups, or straight into the only one.
class MyGroupsView extends StatefulWidget {
  /// [showAll] keeps the list on screen even when it holds a single group.
  const MyGroupsView({super.key, this.showAll = false});

  final bool showAll;

  @override
  State<MyGroupsView> createState() => _MyGroupsViewState();
}

class _MyGroupsViewState extends State<MyGroupsView> {
  MyGroupsViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      _viewModel = MyGroupsViewModel(ServicesScope.of(context).groups)
        ..addListener(_onChange);
      _viewModel!.load();
    }
  }

  void _onChange() {
    final destination = _viewModel!.autoDestination(showAll: widget.showAll);
    if (destination != null && mounted) {
      context.go(destination);
    }
  }

  @override
  void dispose() {
    _viewModel?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final viewModel = _viewModel!;
        return switch (viewModel.status) {
          MyGroupsStatus.failed => GlassPage(
            title: l10n.myGroupsTitle,
            children: [
              Text(l10n.myGroupsFailed),
              FilledButton(
                key: const Key('my-groups-retry'),
                onPressed: viewModel.load,
                child: Text(l10n.myGroupsRetry),
              ),
            ],
          ),
          MyGroupsStatus.loading => const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          ),
          MyGroupsStatus.loaded => GlassPage(
            title: l10n.myGroupsTitle,
            children: [
              for (final group in viewModel.groups)
                _GroupTile(group: group, l10n: l10n),
              FilledButton.icon(
                key: const Key('my-groups-new'),
                onPressed: () => context.go('/org/new'),
                icon: const Icon(Icons.add),
                label: Text(l10n.createGroupTitle),
              ),
            ],
          ),
        };
      },
    );
  }
}

class _GroupTile extends StatelessWidget {
  const _GroupTile({required this.group, required this.l10n});

  final OwnedGroup group;
  final AppLocalizations l10n;

  String get _statusLabel => switch (group.status) {
    'active' => l10n.groupStatusActive,
    'finished' => l10n.groupStatusFinished,
    _ => l10n.groupStatusDraft,
  };

  @override
  Widget build(BuildContext context) => ListTile(
    key: Key('group-${group.id}'),
    contentPadding: EdgeInsets.zero,
    title: Text(group.name),
    subtitle: Text(
      '$_statusLabel · ${l10n.myGroupsMembers(group.activeMembers)}',
    ),
    trailing: const Icon(Icons.chevron_right),
    onTap: () => context.go('/g/${group.id}'),
  );
}
