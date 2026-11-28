import 'package:flutter/material.dart';

class ShellTab {
  const ShellTab({required this.label, required this.icon});

  final String label;
  final IconData icon;
}

/// Where the rail replaces the bottom bar; matches the "Скло" desktop mock-up.
const shellRailBreakpoint = 840.0;

/// Bottom navigation on a phone, a side rail on a wide screen.
class AdaptiveShell extends StatelessWidget {
  const AdaptiveShell({
    super.key,
    required this.currentIndex,
    required this.onSelected,
    required this.tabs,
    required this.child,
  });

  final int currentIndex;
  final ValueChanged<int> onSelected;
  final List<ShellTab> tabs;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= shellRailBreakpoint;
    if (wide) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: currentIndex,
              onDestinationSelected: onSelected,
              labelType: NavigationRailLabelType.all,
              destinations: [
                for (final tab in tabs)
                  NavigationRailDestination(
                    icon: Icon(tab.icon),
                    label: Text(tab.label),
                  ),
              ],
            ),
            Expanded(child: child),
          ],
        ),
      );
    }
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: onSelected,
        destinations: [
          for (final tab in tabs)
            NavigationDestination(icon: Icon(tab.icon), label: tab.label),
        ],
      ),
    );
  }
}
