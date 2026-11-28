import 'dart:async';

import 'package:commandvibe/core/push/push_gateway.dart';

final _pushRoute = RegExp(
  r'^/g/([A-Za-z0-9_-]+)/(today|days|feed|rating|me|notifications|complaints)$',
);

/// The in-app route a push asks for, or null when it is not a plain page of a group
/// (never a link, never another group's page for a member).
String? routeFromPush(Map<String, String> data, {String? memberGroupId}) {
  final route = data['route'];
  final match = route == null ? null : _pushRoute.firstMatch(route);
  if (match == null) {
    return null;
  }
  if (memberGroupId != null && match.group(1) != memberGroupId) {
    return null;
  }
  return route;
}

/// Opens the page a tapped push points to, including a push that started the app.
class PushNavigation {
  PushNavigation(
    Stream<NotificationOpened> opened, {
    required void Function(String route) go,
    required Future<({String? memberGroupId})?> Function() session,
  }) : _go = go,
       _session = session {
    _subscription = opened.listen(_onOpened);
  }

  final void Function(String route) _go;
  final Future<({String? memberGroupId})?> Function() _session;
  late final StreamSubscription<NotificationOpened> _subscription;

  Future<void> _onOpened(NotificationOpened event) async {
    final session = await _session();
    if (session == null) {
      return;
    }
    final route = routeFromPush(
      event.data,
      memberGroupId: session.memberGroupId,
    );
    if (route != null) {
      _go(route);
    }
  }

  Future<void> dispose() => _subscription.cancel();
}
