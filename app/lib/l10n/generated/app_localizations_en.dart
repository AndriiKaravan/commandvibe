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
}
