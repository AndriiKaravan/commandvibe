import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/photos/ui/submit_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// Opens the camera/gallery chooser and runs the upload; completes when the sheet closes.
Future<void> showSubmitSheet(
  BuildContext context, {
  required String groupId,
  required int dayIndex,
}) {
  final services = ServicesScope.of(context);
  final viewModel = SubmitViewModel(
    services.photoSubmissions,
    services.photos,
    groupId: groupId,
    dayIndex: dayIndex,
  );
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => SubmitSheetBody(viewModel: viewModel, closeOnDone: true),
  ).whenComplete(viewModel.dispose);
}

/// What the sheet shows for each stage of an upload.
class SubmitSheetBody extends StatelessWidget {
  const SubmitSheetBody({
    super.key,
    required this.viewModel,
    this.closeOnDone = false,
  });

  final SubmitViewModel viewModel;
  final bool closeOnDone;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        final state = viewModel.state;
        if (state is SubmitDone && closeOnDone) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              Navigator.of(context).pop();
            }
          });
        }
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: switch (state) {
              SubmitIdle() || SubmitDone() => _choices(l10n),
              SubmitUploading() => [
                const Center(child: CircularProgressIndicator()),
                Center(child: Text(l10n.photoUploading)),
              ],
              SubmitConfirmReplace() => [
                Text(l10n.photoConfirmReplace),
                FilledButton(
                  key: const Key('confirm-replace'),
                  onPressed: viewModel.confirmReplace,
                  child: Text(l10n.photoReplaceYes),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: Text(l10n.photoCancel),
                ),
              ],
              SubmitFailed(:final error) => [
                FormMessage(_messageOf(l10n, error)),
                if (error == SubmitError.network || error == SubmitError.failed)
                  FilledButton(
                    onPressed: viewModel.retry,
                    child: Text(l10n.photoRetry),
                  ),
                ..._choices(l10n),
              ],
            },
          ),
        );
      },
    );
  }

  List<Widget> _choices(AppLocalizations l10n) => [
    FilledButton.icon(
      key: const Key('pick-camera'),
      onPressed: () => viewModel.pick(PhotoOrigin.camera),
      icon: const Icon(Icons.photo_camera_outlined),
      label: Text(l10n.photoFromCamera),
    ),
    OutlinedButton.icon(
      key: const Key('pick-gallery'),
      onPressed: () => viewModel.pick(PhotoOrigin.gallery),
      icon: const Icon(Icons.photo_library_outlined),
      label: Text(l10n.photoFromGallery),
    ),
  ];

  String _messageOf(AppLocalizations l10n, SubmitError error) =>
      switch (error) {
        SubmitError.tooLarge => l10n.photoErrTooLarge,
        SubmitError.heicUnsupported => l10n.photoErrHeic,
        SubmitError.unsupportedType ||
        SubmitError.invalidImage => l10n.photoErrInvalid,
        SubmitError.dayClosed => l10n.photoErrDayClosed,
        SubmitError.revealPassed => l10n.photoErrRevealPassed,
        SubmitError.photoHidden => l10n.photoErrHidden,
        SubmitError.network || SubmitError.failed => l10n.photoErrNetwork,
      };
}
