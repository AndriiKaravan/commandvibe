import 'package:commandvibe/features/avatars/avatar_catalog.dart';
import 'package:commandvibe/features/avatars/avatar_picker_view_model.dart';
import 'package:commandvibe/features/avatars/member_avatar.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';

/// Bottom sheet with the avatar collection; saving happens through [onPick].
class AvatarPickerSheet extends StatefulWidget {
  const AvatarPickerSheet({
    super.key,
    required this.displayName,
    required this.current,
    required this.onPick,
  });

  final String displayName;
  final String? current;
  final Future<void> Function(String? id) onPick;

  static Future<void> show(
    BuildContext context, {
    required String displayName,
    required String? current,
    required Future<void> Function(String? id) onPick,
  }) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => AvatarPickerSheet(
      displayName: displayName,
      current: current,
      onPick: onPick,
    ),
  );

  @override
  State<AvatarPickerSheet> createState() => _AvatarPickerSheetState();
}

class _AvatarPickerSheetState extends State<AvatarPickerSheet> {
  late final AvatarPickerViewModel _viewModel = AvatarPickerViewModel(
    current: widget.current,
    save: widget.onPick,
  );

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel,
      builder: (context, _) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              Text(
                l10n.avatarPickerTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (_viewModel.failed)
                Text(
                  l10n.avatarSaveFailed,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final id in AvatarCatalog.ids)
                    _Choice(
                      key: Key('avatar-$id'),
                      selected: id == _viewModel.current,
                      onTap: () => _viewModel.pick(id),
                      child: MemberAvatar(
                        displayName: widget.displayName,
                        avatar: id,
                        size: 52,
                      ),
                    ),
                ],
              ),
              TextButton(
                key: const Key('avatar-initials'),
                onPressed: () => _viewModel.pick(null),
                child: Text(l10n.avatarUseInitials),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({
    super.key,
    required this.selected,
    required this.onTap,
    required this.child,
  });

  final bool selected;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) => InkResponse(
    onTap: onTap,
    radius: 32,
    child: DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          width: 3,
          color: selected
              ? Theme.of(context).colorScheme.primary
              : Colors.transparent,
        ),
      ),
      child: Padding(padding: const EdgeInsets.all(3), child: child),
    ),
  );
}
