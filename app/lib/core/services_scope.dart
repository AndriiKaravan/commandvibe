import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/core/platform/invite_link_source.dart';
import 'package:commandvibe/core/platform/organizer_sign_in.dart';
import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/features/calendar/data/calendar_repository.dart';
import 'package:commandvibe/features/feed/data/feed_repository.dart';
import 'package:commandvibe/features/groups/data/groups_repository.dart';
import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:commandvibe/features/photos/data/photos_repository.dart';
import 'package:commandvibe/features/progress/data/progress_repository.dart';
import 'package:commandvibe/features/standings/data/standings_repository.dart';
import 'package:commandvibe/features/today/data/today_repository.dart';
import 'package:commandvibe/features/organizer_auth/data/organizer_auth_repository.dart';
import 'package:flutter/widgets.dart';
import 'package:ks_core/ks_core.dart';

/// App-wide services, wired by hand (constructor injection, no DI framework).
class AppServices {
  AppServices({
    required this.sessions,
    required this.api,
    required this.realtime,
    required this.inviteLinks,
    required this.photos,
    required this.organizerSignIn,
  });

  final ObservedSessionStore sessions;
  final ApiClient api;
  final RealtimeClient realtime;
  final InviteLinkSource inviteLinks;
  final PhotoSource photos;
  final OrganizerSignIn organizerSignIn;

  late final JoinRepository join = ApiJoinRepository(api, sessions);
  late final GroupsRepository groups = ApiGroupsRepository(api);
  late final CalendarRepository calendar = ApiCalendarRepository(api);
  late final TodayRepository today = ApiTodayRepository(api);
  late final PhotosRepository photoSubmissions = ApiPhotosRepository(api);
  late final FeedRepository feed = ApiFeedRepository(api);
  late final ProgressRepository progress = ApiProgressRepository(api);
  late final StandingsRepository standings = ApiStandingsRepository(api);
  late final OrganizerAuthRepository organizerAuth = ApiOrganizerAuthRepository(
    api,
    sessions,
    organizerSignIn,
  );
}

class ServicesScope extends InheritedWidget {
  const ServicesScope({
    super.key,
    required this.services,
    required super.child,
  });

  final AppServices services;

  static AppServices of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ServicesScope>()!.services;

  @override
  bool updateShouldNotify(ServicesScope oldWidget) =>
      services != oldWidget.services;
}
