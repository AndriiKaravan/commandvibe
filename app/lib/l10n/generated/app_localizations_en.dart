// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'CommandVibe';

  @override
  String get welcomeTitle => 'A photo challenge for your people';

  @override
  String get welcomeBody =>
      'A new task every day; friends\' photos open once you have done it too.';

  @override
  String get organizerSignIn => 'I\'m the organizer';

  @override
  String get haveInvite => 'I have an invite link';

  @override
  String get signInWithGoogle => 'Sign in with Google';

  @override
  String get signInFailed => 'Could not sign in. Please try again.';

  @override
  String get openInBrowserHint =>
      'If sign-in does not open, open this page in your browser.';

  @override
  String get createGroupTitle => 'New group';

  @override
  String get groupNameLabel => 'Group name';

  @override
  String get playsTooLabel => 'I play too';

  @override
  String get approveNewLabel => 'Approve new members';

  @override
  String get createGroupAction => 'Create';

  @override
  String get inviteTitle => 'Invite players';

  @override
  String get inviteBody =>
      'Send this link to the group chat. Whoever opens it enters a name and is in.';

  @override
  String get shareInvite => 'Share link';

  @override
  String get copyInvite => 'Copy';

  @override
  String get copied => 'Copied';

  @override
  String get toGroup => 'To the group';

  @override
  String joinTitle(String groupName) {
    return 'You\'re invited to \"$groupName\"';
  }

  @override
  String joinMembers(int count) {
    return 'Already playing: $count';
  }

  @override
  String get yourNameLabel => 'Your name or nickname';

  @override
  String get joinAction => 'Join the game';

  @override
  String get alreadyPlaying => 'I\'m already playing';

  @override
  String get nameTaken =>
      'This name is taken in the group. Pick another or tap \"I\'m already playing\".';

  @override
  String get inviteClosed =>
      'This link no longer works. Ask the organizer for a new one.';

  @override
  String get groupFull => 'The group is full.';

  @override
  String get invalidName => 'Enter a name up to 40 characters.';

  @override
  String get pendingApproval => 'Waiting for the organizer to approve you.';

  @override
  String get pinTitle => 'Pick a PIN';

  @override
  String get pinBody => '4 digits to sign in from another device.';

  @override
  String get pinLabel => 'PIN';

  @override
  String get pinSave => 'Save';

  @override
  String get pinSkip => 'Later';

  @override
  String get pinInvalid => 'The PIN is exactly 4 digits.';

  @override
  String get returningTitle => 'Back to the game';

  @override
  String get returningAction => 'Sign in';

  @override
  String wrongPin(int attemptsLeft) {
    return 'Wrong PIN. Attempts left: $attemptsLeft';
  }

  @override
  String pinLocked(int minutes) {
    return 'Too many attempts. Try again in $minutes min or ask the organizer to reset your PIN.';
  }

  @override
  String get noSuchLogin =>
      'No player with a PIN by that name. Check the name.';

  @override
  String get networkError => 'No connection to the server. Check the internet.';

  @override
  String get genericError => 'Something went wrong. Please try again.';

  @override
  String get membersTitle => 'Players';

  @override
  String get pendingMembers => 'Waiting for approval';

  @override
  String get approve => 'Approve';

  @override
  String get remove => 'Remove';

  @override
  String get you => 'you';

  @override
  String get signOut => 'Sign out';

  @override
  String get organizerOwnLink =>
      'You are signed in as the organizer on this device. To play as a member, open the link on another device or browser.';

  @override
  String get groupCalendarButton => 'Game calendar';

  @override
  String get calendarTitle => 'Game calendar';

  @override
  String get gameSetupTitle => 'Game setup';

  @override
  String startDateLabel(String date) {
    return 'First day: $date';
  }

  @override
  String daysLabel(int count) {
    return 'Length: $count days';
  }

  @override
  String openTimeLabel(String time) {
    return 'Day opens at: $time';
  }

  @override
  String get modeLabel => 'How tasks are chosen';

  @override
  String get modeAuto => 'Automatic daily';

  @override
  String get modeRoulette => 'Roulette';

  @override
  String get categoriesLabel => 'Task topics';

  @override
  String get categoryHome => 'At home';

  @override
  String get categoryStreet => 'Outdoors';

  @override
  String get categoryOffice => 'Office';

  @override
  String get categoryCheap => 'Cheap';

  @override
  String get categoryKids => 'With kids';

  @override
  String get categoryWinter => 'Winter';

  @override
  String get categorySummer => 'Summer';

  @override
  String get categoryTeam => 'Team';

  @override
  String get categoryPair => 'Pairs';

  @override
  String get saveGame => 'Build the calendar';

  @override
  String get setupStartInPast => 'The first day cannot be in the past.';

  @override
  String get setupInvalidDays => 'The game lasts from 7 to 31 days.';

  @override
  String get setupNoCategories => 'Pick at least one topic.';

  @override
  String get setupGameStarted =>
      'The game has started, so the setup can no longer change.';

  @override
  String dayNumber(int number) {
    return 'Day $number';
  }

  @override
  String get dayOpenState => 'open';

  @override
  String get dayPickingState => 'roulette is choosing';

  @override
  String get otherTask => 'Another';

  @override
  String get pickTask => 'From catalog';

  @override
  String get ownTask => 'Own task';

  @override
  String get moveDayUp => 'Earlier';

  @override
  String get moveDayDown => 'Later';

  @override
  String get editDayOpened =>
      'This day has already opened and cannot be changed.';

  @override
  String get editNoMoreTasks => 'There are no new tasks left for these topics.';

  @override
  String get editTaskInGame => 'This task is already in the calendar.';

  @override
  String get calendarNotSetUp => 'The calendar is not set up yet.';

  @override
  String get setUpGame => 'Set up the game';

  @override
  String get changeSettings => 'Change settings';

  @override
  String get catalogSearchHint => 'Search tasks';

  @override
  String get catalogAllCategories => 'All topics';

  @override
  String get catalogNothingFound => 'Nothing found.';

  @override
  String get ownTaskTitle => 'Your own task';

  @override
  String get ownTaskNameLabel => 'Title';

  @override
  String get ownTaskDescriptionLabel => 'Description';

  @override
  String get ownTaskNameEnLabel => 'Title (English, optional)';

  @override
  String get ownTaskDescriptionEnLabel => 'Description (English, optional)';

  @override
  String get ownTaskNameInvalid => 'Enter a title up to 60 characters.';

  @override
  String get ownTaskDescriptionInvalid =>
      'Enter a description up to 220 characters.';

  @override
  String get saveTask => 'Save';

  @override
  String get retry => 'Retry';

  @override
  String get todayTitle => 'Task of the day';

  @override
  String get todayNotConfigured => 'The game is not set up yet.';

  @override
  String todayBeforeStart(String when) {
    return 'The game starts $when';
  }

  @override
  String get todayWaitingMine => 'Your turn to spin the roulette!';

  @override
  String get todayWaitingOther =>
      'Another player spins the roulette. If they run out of time, the game spins it.';

  @override
  String todaySpinUntil(String time) {
    return 'Spin before $time';
  }

  @override
  String get todaySpin => 'Spin';

  @override
  String get todaySpinning => 'The roulette is spinning…';

  @override
  String get todayLoadingTask => 'Loading the task…';

  @override
  String get todayFinished => 'The game is over. Thanks for playing!';

  @override
  String get todayTurnOver => 'The roulette has already been spun.';
}
