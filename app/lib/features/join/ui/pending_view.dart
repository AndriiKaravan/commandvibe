import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/join/ui/pending_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Shown after joining a group that approves newcomers; moves on by itself once approved.
class PendingView extends StatefulWidget {
  const PendingView({super.key, required this.memberId, required this.groupId});

  final String memberId;
  final String groupId;

  @override
  State<PendingView> createState() => _PendingViewState();
}

class _PendingViewState extends State<PendingView> {
  PendingViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_viewModel == null) {
      final services = ServicesScope.of(context);
      _viewModel =
          PendingViewModel(
              services.join,
              services.realtime,
              memberId: widget.memberId,
            )
            ..addListener(_onChange)
            ..start();
    }
  }

  void _onChange() {
    if (_viewModel!.approved && mounted) {
      context.go('/pin?g=${widget.groupId}');
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
    return GlassPage(
      children: [
        const Center(child: CircularProgressIndicator()),
        Text(l10n.pendingApproval, textAlign: TextAlign.center),
      ],
    );
  }
}
