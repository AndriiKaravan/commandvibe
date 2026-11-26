import 'package:commandvibe/core/services_scope.dart';
import 'package:commandvibe/core/ui/glass_page.dart';
import 'package:commandvibe/features/join/ui/pin_setup_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

class PinSetupView extends StatefulWidget {
  const PinSetupView({super.key, required this.groupId});

  final String groupId;

  @override
  State<PinSetupView> createState() => _PinSetupViewState();
}

class _PinSetupViewState extends State<PinSetupView> {
  final _pin = TextEditingController();
  PinSetupViewModel? _viewModel;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _viewModel ??= PinSetupViewModel(ServicesScope.of(context).join)
      ..addListener(_onChange);
  }

  void _onChange() {
    if (_viewModel!.status == PinSetupStatus.saved && mounted) {
      context.go('/g/${widget.groupId}');
    }
  }

  @override
  void dispose() {
    _pin.dispose();
    _viewModel?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: _viewModel!,
      builder: (context, _) {
        final status = _viewModel!.status;
        return GlassPage(
          title: l10n.pinTitle,
          children: [
            Text(l10n.pinBody),
            TextField(
              key: const Key('pin-field'),
              controller: _pin,
              autofocus: true,
              obscureText: true,
              keyboardType: TextInputType.number,
              maxLength: 4,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(labelText: l10n.pinLabel),
              onSubmitted: _viewModel!.save,
            ),
            if (status == PinSetupStatus.invalid) FormMessage(l10n.pinInvalid),
            if (status == PinSetupStatus.failed) FormMessage(l10n.genericError),
            FilledButton(
              key: const Key('pin-save'),
              onPressed: status == PinSetupStatus.saving
                  ? null
                  : () => _viewModel!.save(_pin.text),
              child: Text(l10n.pinSave),
            ),
            TextButton(
              onPressed: () => context.go('/g/${widget.groupId}'),
              child: Text(l10n.pinSkip),
            ),
          ],
        );
      },
    );
  }
}
