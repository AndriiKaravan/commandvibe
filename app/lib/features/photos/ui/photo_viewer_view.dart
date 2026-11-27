import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/data/photos_repository.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// One photo on the whole screen; members can report it, the organizer can hide it.
class PhotoViewerView extends StatefulWidget {
  const PhotoViewerView({
    super.key,
    required this.groupId,
    required this.dayIndex,
    required this.memberId,
  });

  final String groupId;
  final int dayIndex;
  final String memberId;

  @override
  State<PhotoViewerView> createState() => _PhotoViewerViewState();
}

class _PhotoViewerViewState extends State<PhotoViewerView> {
  PhotosRepository? _repository;
  SubmissionItem? _item;
  bool _failed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_repository == null) {
      _repository = ServicesScope.of(context).photoSubmissions;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final day = await _repository!.day(widget.groupId, widget.dayIndex);
      final all = [if (day.mine != null) day.mine!, ...day.items];
      final found = all.where((item) => item.memberId == widget.memberId);
      if (mounted) {
        setState(() {
          _item = found.isEmpty ? null : found.first;
          _failed = found.isEmpty;
        });
      }
    } on ApiException {
      if (mounted) {
        setState(() => _failed = true);
      }
    } on NetworkException {
      if (mounted) {
        setState(() => _failed = true);
      }
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } on ApiException {
      // The list below is reloaded anyway; a refused action just shows the current state.
    } on NetworkException {
      // Same: nothing changed on the server.
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final item = _item;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent),
      body: SafeArea(
        child: item == null
            ? Center(
                child: _failed
                    ? Text(l10n.photoViewerFailed)
                    : const CircularProgressIndicator(),
              )
            : PhotoViewerBody(
                item: item,
                onImageFailed: _load,
                onReport: (reason) async {
                  await _run(
                    () => _repository!.complain(
                      widget.groupId,
                      widget.dayIndex,
                      item.memberId,
                      reason,
                    ),
                  );
                  if (context.mounted) {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text(l10n.photoReported)));
                  }
                },
                onHide: (hidden) => _run(
                  () => _repository!.setHidden(
                    widget.groupId,
                    widget.dayIndex,
                    item.memberId,
                    hidden,
                  ),
                ),
                onDismiss: () => _run(
                  () => _repository!.dismiss(
                    widget.groupId,
                    widget.dayIndex,
                    item.memberId,
                  ),
                ),
              ),
      ),
    );
  }
}

/// The photo and what can be done with it; pure presentation.
class PhotoViewerBody extends StatelessWidget {
  const PhotoViewerBody({
    super.key,
    required this.item,
    required this.onReport,
    required this.onHide,
    required this.onDismiss,
    required this.onImageFailed,
  });

  final SubmissionItem item;
  final Future<void> Function(ComplaintReason reason) onReport;
  final Future<void> Function(bool hidden) onHide;
  final Future<void> Function() onDismiss;
  final VoidCallback onImageFailed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final moderation = item.moderation;
    final url = item.photoUrl ?? item.blurUrl;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: InteractiveViewer(
            child: Image.network(
              url.toString(),
              fit: BoxFit.contain,
              errorBuilder: (context, error, stack) {
                WidgetsBinding.instance.addPostFrameCallback(
                  (_) => onImageFailed(),
                );
                return const SizedBox(
                  height: 240,
                  child: ColoredBox(color: Colors.black26),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(item.displayName, style: text.titleMedium),
        if (item.isHidden) FormMessage(l10n.photoHiddenBadge),
        if (moderation != null) ..._moderation(context, l10n, moderation),
        if (moderation == null && !item.mine)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _askReason(context),
              icon: const Icon(Icons.flag_outlined),
              label: Text(l10n.photoReport),
            ),
          ),
      ],
    );
  }

  List<Widget> _moderation(
    BuildContext context,
    AppLocalizations l10n,
    Moderation moderation,
  ) => [
    if (moderation.takenBefore)
      Chip(
        avatar: const Icon(Icons.history),
        label: Text(l10n.photoTakenEarlier),
      ),
    if (moderation.source == 'camera')
      Text(l10n.photoSourceCamera)
    else if (moderation.source == 'gallery')
      Text(l10n.photoSourceGallery),
    if (moderation.openComplaints > 0)
      Text(l10n.photoOpenComplaints(moderation.openComplaints)),
    Wrap(
      spacing: 8,
      children: [
        FilledButton(
          key: const Key('hide-photo'),
          onPressed: () => onHide(!item.isHidden),
          child: Text(item.isHidden ? l10n.photoRestore : l10n.photoHide),
        ),
        if (moderation.openComplaints > 0)
          OutlinedButton(
            key: const Key('dismiss-complaints'),
            onPressed: onDismiss,
            child: Text(l10n.photoDismiss),
          ),
      ],
    ),
  ];

  Future<void> _askReason(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    final reason = await showModalBottomSheet<ComplaintReason>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final (value, label) in [
              (ComplaintReason.inappropriate, l10n.photoReasonInappropriate),
              (ComplaintReason.notTask, l10n.photoReasonNotTask),
              (ComplaintReason.other, l10n.photoReasonOther),
            ])
              ListTile(
                title: Text(label),
                onTap: () => Navigator.of(context).pop(value),
              ),
          ],
        ),
      ),
    );
    if (reason != null) {
      await onReport(reason);
    }
  }
}
