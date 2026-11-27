import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/ui/complaints_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// The organizer's list of photos that members reported.
class ComplaintsView extends StatefulWidget {
  const ComplaintsView({super.key, required this.groupId});

  final String groupId;

  @override
  State<ComplaintsView> createState() => _ComplaintsViewState();
}

class _ComplaintsViewState extends State<ComplaintsView> {
  ComplaintsViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel = ComplaintsViewModel(
        services.photoSubmissions,
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
    final l10n = AppLocalizations.of(context);
    final viewModel = _viewModel!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.complaintsTitle),
        backgroundColor: Colors.transparent,
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListenableBuilder(
              listenable: viewModel,
              builder: (context, _) {
                if (!viewModel.loaded) {
                  return Center(
                    child: viewModel.loadFailed
                        ? FormMessage(l10n.networkError)
                        : const CircularProgressIndicator(),
                  );
                }
                if (viewModel.items.isEmpty) {
                  return Center(child: Text(l10n.complaintsEmpty));
                }
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    for (final item in viewModel.items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ComplaintTile(
                          item: item,
                          groupId: widget.groupId,
                          viewModel: viewModel,
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _ComplaintTile extends StatelessWidget {
  const _ComplaintTile({
    required this.item,
    required this.groupId,
    required this.viewModel,
  });

  final ComplaintItem item;
  final String groupId;
  final ComplaintsViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return GlassPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          Text(
            '${item.displayName} · ${l10n.complaintsDay(item.dayIndex + 1)}',
            style: text.titleMedium,
          ),
          Text(l10n.photoOpenComplaints(item.count)),
          Text(item.complainers.map((c) => c.displayName).join(', ')),
          Wrap(
            spacing: 8,
            children: [
              OutlinedButton(
                onPressed: () => context.push(
                  '/g/$groupId/photo/${item.dayIndex}/${item.memberId}',
                ),
                child: Text(l10n.photoOpen),
              ),
              if (!item.hidden)
                FilledButton(
                  onPressed: () => viewModel.hide(item),
                  child: Text(l10n.photoHide),
                ),
              TextButton(
                onPressed: () => viewModel.dismiss(item),
                child: Text(l10n.photoDismiss),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// "Reports (N)" on the group home; follows the organizer topic so the count stays current.
class ComplaintsButton extends StatefulWidget {
  const ComplaintsButton({super.key, required this.groupId});

  final String groupId;

  @override
  State<ComplaintsButton> createState() => _ComplaintsButtonState();
}

class _ComplaintsButtonState extends State<ComplaintsButton> {
  ComplaintsViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel = ComplaintsViewModel(
        services.photoSubmissions,
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
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) => OutlinedButton.icon(
        key: const Key('open-complaints'),
        onPressed: () => context.push('/g/${widget.groupId}/complaints'),
        icon: const Icon(Icons.flag_outlined),
        label: Text(l10n.complaintsButton(_viewModel!.count)),
      ),
    );
  }
}
