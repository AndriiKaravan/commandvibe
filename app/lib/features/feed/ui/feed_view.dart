import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/feed/ui/feed_card.dart';
import 'package:commandvibe/features/feed/ui/feed_filters_bar.dart';
import 'package:commandvibe/features/feed/ui/feed_view_model.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The "Feed" tab: everyone's photos, newest first, as in a photo app.
class FeedView extends StatefulWidget {
  const FeedView({super.key, required this.groupId});

  final String groupId;

  @override
  State<FeedView> createState() => _FeedViewState();
}

class _FeedViewState extends State<FeedView> {
  final _scroll = ScrollController();
  FeedViewModel? _viewModel;
  List<GroupMember> _members = const [];
  List<int> _days = const [];

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel != null) {
      return;
    }
    final services = ServicesScope.of(context);
    _viewModel = FeedViewModel(
      services.feed,
      services.realtime,
      groupId: widget.groupId,
    )..start();
    _loadChoices(services);
  }

  /// The filter menus are a convenience; if they cannot load, the feed still works.
  Future<void> _loadChoices(AppServices services) async {
    try {
      final members = await services.groups.members(widget.groupId);
      final calendar = await services.calendar.calendar(widget.groupId);
      if (!mounted) {
        return;
      }
      setState(() {
        _members = members.where((m) => !m.isPending).toList();
        _days = [
          for (final day in calendar.days)
            if (day.state == DayState.open) day.dayIndex,
        ];
      });
    } on Exception {
      // Leave the menus empty.
    }
  }

  void _onScroll() {
    final position = _scroll.position;
    if (position.pixels >= position.maxScrollExtent - 400) {
      _viewModel?.loadMore();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    _viewModel?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final viewModel = _viewModel!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.tabFeed),
        backgroundColor: Colors.transparent,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListenableBuilder(
              listenable: viewModel,
              builder: (context, _) => Column(
                children: [
                  FeedFiltersBar(
                    filter: viewModel.filter,
                    days: _days,
                    members: _members,
                    onChanged: viewModel.setFilter,
                  ),
                  Expanded(child: _list(context, viewModel, l10n)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _list(
    BuildContext context,
    FeedViewModel viewModel,
    AppLocalizations l10n,
  ) {
    if (!viewModel.isLoaded) {
      return viewModel.loadFailed
          ? Center(child: Text(l10n.networkError))
          : const Center(child: CircularProgressIndicator());
    }
    if (viewModel.items.isEmpty) {
      return Center(child: Text(l10n.feedEmpty));
    }
    final items = viewModel.items;
    return ListView.separated(
      controller: _scroll,
      padding: const EdgeInsets.all(16),
      itemCount: items.length + (viewModel.hasMore ? 1 : 0),
      separatorBuilder: (context, _) => const SizedBox(height: 16),
      itemBuilder: (context, index) {
        if (index >= items.length) {
          return const Center(child: CircularProgressIndicator());
        }
        final item = items[index];
        return FeedCard(
          key: ValueKey(item.key),
          item: item,
          onImageFailed: viewModel.imageFailed,
          onOpen: () => context.push(
            '/g/${widget.groupId}/photo/${item.dayIndex}/${item.photo.memberId}',
          ),
        );
      },
    );
  }
}
