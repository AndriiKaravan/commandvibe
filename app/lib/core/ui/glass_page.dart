import 'package:commandvibe/core/theme/glass_panel.dart';
import 'package:flutter/material.dart';

/// A centred, width-limited page of glass panels; works from phone to desktop.
class GlassPage extends StatelessWidget {
  const GlassPage({super.key, required this.children, this.title});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: title == null
          ? null
          : AppBar(
              title: Text(title!),
              backgroundColor: Colors.transparent,
              elevation: 0,
            ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.all(16),
              shrinkWrap: true,
              children: [
                GlassPanel(
                  child: DefaultTextStyle.merge(
                    style: text.bodyLarge,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisSize: MainAxisSize.min,
                      spacing: 16,
                      children: children,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A one-line message under a form: errors in the error colour.
class FormMessage extends StatelessWidget {
  const FormMessage(this.text, {super.key, this.isError = true});

  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Text(
      text,
      style: TextStyle(
        color: isError ? Theme.of(context).colorScheme.error : null,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
