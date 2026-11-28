import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/platform/session_store.dart';
import 'package:commandvibe/features/calendar/ui/calendar_editor_view.dart';
import 'package:commandvibe/features/calendar/ui/days_view.dart';
import 'package:commandvibe/features/calendar/ui/game_setup_view.dart';
import 'package:commandvibe/features/feed/ui/feed_view.dart';
import 'package:commandvibe/features/groups/ui/create_group_view.dart';
import 'package:commandvibe/features/groups/ui/group_home_view.dart';
import 'package:commandvibe/features/groups/ui/invite_view.dart';
import 'package:commandvibe/features/groups/ui/my_groups_view.dart';
import 'package:commandvibe/features/join/ui/join_view.dart';
import 'package:commandvibe/features/join/ui/pending_view.dart';
import 'package:commandvibe/features/join/ui/pin_setup_view.dart';
import 'package:commandvibe/features/join/ui/returning_view.dart';
import 'package:commandvibe/features/organizer_auth/ui/organizer_login_view.dart';
import 'package:commandvibe/features/photos/ui/complaints_view.dart';
import 'package:commandvibe/features/photos/ui/photo_viewer_view.dart';
import 'package:commandvibe/features/shell/group_shell.dart';
import 'package:commandvibe/features/standings/ui/standings_view.dart';
import 'package:commandvibe/features/today/ui/today_tab.dart';
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
  return session.isOrganizer ? '/org/groups' : '/';
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
        path: '/org/groups',
        redirect: (context, state) async {
          final session = await sessions.read();
          return session?.isOrganizer == true ? null : '/org/login';
        },
        builder: (context, state) =>
            MyGroupsView(showAll: state.uri.queryParameters['all'] == '1'),
      ),
      GoRoute(
        path: '/org/new',
        redirect: (context, state) async {
          final session = await sessions.read();
          return session?.isOrganizer == true ? null : '/org/login';
        },
        builder: (context, state) => const CreateGroupView(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => _GroupTabs(
          groupId: state.pathParameters['groupId']!,
          sessions: sessions,
          shell: shell,
        ),
        branches: [
          _tab(
            'today',
            requireSession,
            (state) => TodayTab(groupId: state.pathParameters['groupId']!),
          ),
          _tab(
            'days',
            requireSession,
            (state) => DaysView(groupId: state.pathParameters['groupId']!),
          ),
          _tab(
            'feed',
            requireSession,
            (state) => FeedView(groupId: state.pathParameters['groupId']!),
          ),
          _tab(
            'rating',
            requireSession,
            (state) => StandingsView(groupId: state.pathParameters['groupId']!),
          ),
          _tab(
            'me',
            requireSession,
            (state) => _GroupHome(
              groupId: state.pathParameters['groupId']!,
              sessions: sessions,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/g/:groupId',
        redirect: (context, state) async {
          final gate = await requireSession(state);
          if (gate != null) {
            return gate;
          }
          // Only the bare group address lands on the first tab; sub-pages keep their own path.
          return state.uri.path == '/g/${state.pathParameters['groupId']}'
              ? '/g/${state.pathParameters['groupId']}/today'
              : null;
        },
        builder: (context, state) => const SizedBox.shrink(),
        routes: [
          GoRoute(
            path: 'calendar',
            redirect: (context, state) => requireOrganizer(state),
            builder: (context, state) =>
                CalendarEditorView(groupId: state.pathParameters['groupId']!),
          ),
          GoRoute(
            path: 'photo/:day/:memberId',
            builder: (context, state) => PhotoViewerView(
              groupId: state.pathParameters['groupId']!,
              dayIndex: int.tryParse(state.pathParameters['day']!) ?? 0,
              memberId: state.pathParameters['memberId']!,
            ),
          ),
          GoRoute(
            path: 'complaints',
            redirect: (context, state) => requireOrganizer(state),
            builder: (context, state) =>
                ComplaintsView(groupId: state.pathParameters['groupId']!),
          ),
          GoRoute(
            path: 'invite',
            redirect: (context, state) => requireOrganizer(state),
            builder: (context, state) =>
                InviteView(groupId: state.pathParameters['groupId']!),
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

StatefulShellBranch _tab(
  String name,
  Future<String?> Function(GoRouterState state) redirect,
  Widget Function(GoRouterState state) build,
) => StatefulShellBranch(
  routes: [
    GoRoute(
      path: '/g/:groupId/$name',
      redirect: (context, state) => redirect(state),
      builder: (context, state) => build(state),
    ),
  ],
);

/// Reads the session once to know whether the viewer owns the group, then frames the tabs.
class _GroupTabs extends StatelessWidget {
  const _GroupTabs({
    required this.groupId,
    required this.sessions,
    required this.shell,
  });

  final String groupId;
  final SessionStore sessions;
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) => FutureBuilder<StoredSession?>(
    future: sessions.read(),
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      return GroupShell(
        groupId: groupId,
        isOwner: snapshot.data!.isOrganizer,
        currentIndex: shell.currentIndex,
        onSelected: (index) =>
            shell.goBranch(index, initialLocation: index == shell.currentIndex),
        child: shell,
      );
    },
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
