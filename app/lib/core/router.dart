import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:commandvibe/features/calendar/ui/calendar_editor_view.dart';
import 'package:commandvibe/features/calendar/ui/game_setup_view.dart';
import 'package:commandvibe/features/groups/ui/create_group_view.dart';
import 'package:commandvibe/features/groups/ui/group_home_view.dart';
import 'package:commandvibe/features/join/ui/join_view.dart';
import 'package:commandvibe/features/join/ui/pending_view.dart';
import 'package:commandvibe/features/join/ui/pin_setup_view.dart';
import 'package:commandvibe/features/join/ui/returning_view.dart';
import 'package:commandvibe/features/organizer_auth/ui/organizer_login_view.dart';
import 'package:commandvibe/features/welcome/welcome_view.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Where the app opens: an invite link wins, then the saved session, then the welcome screen.
Future<String> initialLocation(
  SessionStore sessions,
  String? inviteToken,
) async {
  if (inviteToken != null) {
    return Uri(path: '/join', queryParameters: {'t': inviteToken}).toString();
  }
  final session = await sessions.read();
  if (session == null) {
    return '/';
  }
  if (session.groupId != null) {
    return '/g/${session.groupId}';
  }
  return session.isOrganizer ? '/org/new' : '/';
}

/// [sessions] doubles as the router's refresh signal: a lost session leaves protected pages at once.
GoRouter createRouter({
  required ObservedSessionStore sessions,
  required String initial,
}) {
  Future<String?> requireSession(GoRouterState state) async =>
      await sessions.read() == null ? '/' : null;

  // The calendar tools belong to the organizer; a member who opens the URL lands on the group.
  Future<String?> requireOrganizer(GoRouterState state) async {
    final session = await sessions.read();
    if (session == null) {
      return '/';
    }
    return session.isOrganizer ? null : '/g/${state.pathParameters['groupId']}';
  }

  return GoRouter(
    initialLocation: initial,
    refreshListenable: sessions,
    routes: [
      GoRoute(path: '/', builder: (context, state) => const WelcomeView()),
      GoRoute(
        path: '/join',
        builder: (context, state) =>
            JoinView(token: state.uri.queryParameters['t'] ?? ''),
        routes: [
          GoRoute(
            path: 'returning',
            builder: (context, state) =>
                ReturningView(token: state.uri.queryParameters['t'] ?? ''),
          ),
        ],
      ),
      GoRoute(
        path: '/waiting',
        redirect: (context, state) => requireSession(state),
        builder: (context, state) => PendingView(
          memberId: state.uri.queryParameters['m'] ?? '',
          groupId: state.uri.queryParameters['g'] ?? '',
        ),
      ),
      GoRoute(
        path: '/pin',
        redirect: (context, state) => requireSession(state),
        builder: (context, state) =>
            PinSetupView(groupId: state.uri.queryParameters['g'] ?? ''),
      ),
      GoRoute(
        path: '/org/login',
        builder: (context, state) => const OrganizerLoginView(),
      ),
      GoRoute(
        path: '/org/new',
        redirect: (context, state) async {
          final session = await sessions.read();
          return session?.isOrganizer == true ? null : '/org/login';
        },
        builder: (context, state) => const CreateGroupView(),
      ),
      GoRoute(
        path: '/g/:groupId',
        redirect: (context, state) => requireSession(state),
        builder: (context, state) => _GroupHome(
          groupId: state.pathParameters['groupId']!,
          sessions: sessions,
        ),
        routes: [
          GoRoute(
            path: 'calendar',
            redirect: (context, state) => requireOrganizer(state),
            builder: (context, state) =>
                CalendarEditorView(groupId: state.pathParameters['groupId']!),
          ),
          GoRoute(
            path: 'setup',
            redirect: (context, state) => requireOrganizer(state),
            builder: (context, state) =>
                GameSetupView(groupId: state.pathParameters['groupId']!),
          ),
        ],
      ),
    ],
  );
}

/// Reads the session once to know whether the viewer owns the group.
class _GroupHome extends StatelessWidget {
  const _GroupHome({required this.groupId, required this.sessions});

  final String groupId;
  final SessionStore sessions;

  @override
  Widget build(BuildContext context) => FutureBuilder<StoredSession?>(
    future: sessions.read(),
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      return GroupHomeView(
        groupId: groupId,
        isOwner: snapshot.data!.isOrganizer,
      );
    },
  );
}
