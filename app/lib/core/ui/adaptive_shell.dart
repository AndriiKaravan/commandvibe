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
    this.badges = const {},
  });

  final int currentIndex;
  final ValueChanged<int> onSelected;
  final List<ShellTab> tabs;
  final Widget child;

  /// Indexes of tabs that show a dot because something new is waiting there.
  final Set<int> badges;

  Widget _icon(int index) => Badge(
    isLabelVisible: badges.contains(index),
    smallSize: 8,
    child: Icon(tabs[index].icon),
  );

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
                for (var i = 0; i < tabs.length; i++)
                  NavigationRailDestination(
                    icon: _icon(i),
                    label: Text(tabs[i].label),
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
          for (var i = 0; i < tabs.length; i++)
            NavigationDestination(icon: _icon(i), label: tabs[i].label),
        ],
      ),
    );
  }
}
