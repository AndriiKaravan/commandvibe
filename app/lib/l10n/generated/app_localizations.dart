import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_uk.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('uk'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In uk, this message translates to:
  /// **'CommandVibe'**
  String get appTitle;

  /// No description provided for @welcomeTitle.
  ///
  /// In uk, this message translates to:
  /// **'Фото-челендж для своїх'**
  String get welcomeTitle;

  /// No description provided for @welcomeBody.
  ///
  /// In uk, this message translates to:
  /// **'Щодня нове завдання, фото друзів відкриваються, коли виконаєш і ти.'**
  String get welcomeBody;

  /// No description provided for @organizerSignIn.
  ///
  /// In uk, this message translates to:
  /// **'Я організатор'**
  String get organizerSignIn;

  /// No description provided for @haveInvite.
  ///
  /// In uk, this message translates to:
  /// **'У мене є посилання-запрошення'**
  String get haveInvite;

  /// No description provided for @signInWithGoogle.
  ///
  /// In uk, this message translates to:
  /// **'Увійти через Google'**
  String get signInWithGoogle;

  /// No description provided for @signInFailed.
  ///
  /// In uk, this message translates to:
  /// **'Не вдалося увійти. Спробуй ще раз.'**
  String get signInFailed;

  /// No description provided for @openInBrowserHint.
  ///
  /// In uk, this message translates to:
  /// **'Якщо вхід не відкривається, відкрий сторінку у браузері.'**
  String get openInBrowserHint;

  /// No description provided for @createGroupTitle.
  ///
  /// In uk, this message translates to:
  /// **'Нова група'**
  String get createGroupTitle;

  /// No description provided for @groupNameLabel.
  ///
  /// In uk, this message translates to:
  /// **'Назва групи'**
  String get groupNameLabel;

  /// No description provided for @playsTooLabel.
  ///
  /// In uk, this message translates to:
  /// **'Я теж граю'**
  String get playsTooLabel;

  /// No description provided for @approveNewLabel.
  ///
  /// In uk, this message translates to:
  /// **'Підтверджувати нових учасників'**
  String get approveNewLabel;

  /// No description provided for @createGroupAction.
  ///
  /// In uk, this message translates to:
  /// **'Створити'**
  String get createGroupAction;

  /// No description provided for @inviteTitle.
  ///
  /// In uk, this message translates to:
  /// **'Запроси учасників'**
  String get inviteTitle;

  /// No description provided for @inviteBody.
  ///
  /// In uk, this message translates to:
  /// **'Надішли це посилання в чат групи. Хто відкриє — вводить ім\'я і вже в грі.'**
  String get inviteBody;

  /// No description provided for @shareInvite.
  ///
  /// In uk, this message translates to:
  /// **'Поділитися посиланням'**
  String get shareInvite;

  /// No description provided for @copyInvite.
  ///
  /// In uk, this message translates to:
  /// **'Скопіювати'**
  String get copyInvite;

  /// No description provided for @copied.
  ///
  /// In uk, this message translates to:
  /// **'Скопійовано'**
  String get copied;

  /// No description provided for @toGroup.
  ///
  /// In uk, this message translates to:
  /// **'До групи'**
  String get toGroup;

  /// No description provided for @joinTitle.
  ///
  /// In uk, this message translates to:
  /// **'Вас запросили в «{groupName}»'**
  String joinTitle(String groupName);

  /// No description provided for @joinMembers.
  ///
  /// In uk, this message translates to:
  /// **'Уже в грі: {count}'**
  String joinMembers(int count);

  /// No description provided for @yourNameLabel.
  ///
  /// In uk, this message translates to:
  /// **'Твоє ім\'я або нікнейм'**
  String get yourNameLabel;

  /// No description provided for @joinAction.
  ///
  /// In uk, this message translates to:
  /// **'Увійти в гру'**
  String get joinAction;

  /// No description provided for @alreadyPlaying.
  ///
  /// In uk, this message translates to:
  /// **'Я вже в грі'**
  String get alreadyPlaying;

  /// No description provided for @nameTaken.
  ///
  /// In uk, this message translates to:
  /// **'Таке ім\'я вже є в групі. Обери інше або натисни «Я вже в грі».'**
  String get nameTaken;

  /// No description provided for @inviteClosed.
  ///
  /// In uk, this message translates to:
  /// **'Посилання більше не діє. Попроси організатора надіслати нове.'**
  String get inviteClosed;

  /// No description provided for @groupFull.
  ///
  /// In uk, this message translates to:
  /// **'У групі вже немає місць.'**
  String get groupFull;

  /// No description provided for @invalidName.
  ///
  /// In uk, this message translates to:
  /// **'Введи ім\'я до 40 символів.'**
  String get invalidName;

  /// No description provided for @pendingApproval.
  ///
  /// In uk, this message translates to:
  /// **'Чекаємо підтвердження організатора.'**
  String get pendingApproval;

  /// No description provided for @pinTitle.
  ///
  /// In uk, this message translates to:
  /// **'Придумай PIN'**
  String get pinTitle;

  /// No description provided for @pinBody.
  ///
  /// In uk, this message translates to:
  /// **'4 цифри, щоб увійти з іншого пристрою.'**
  String get pinBody;

  /// No description provided for @pinLabel.
  ///
  /// In uk, this message translates to:
  /// **'PIN'**
  String get pinLabel;

  /// No description provided for @pinSave.
  ///
  /// In uk, this message translates to:
  /// **'Зберегти'**
  String get pinSave;

  /// No description provided for @pinSkip.
  ///
  /// In uk, this message translates to:
  /// **'Пізніше'**
  String get pinSkip;

  /// No description provided for @pinInvalid.
  ///
  /// In uk, this message translates to:
  /// **'PIN — рівно 4 цифри.'**
  String get pinInvalid;

  /// No description provided for @returningTitle.
  ///
  /// In uk, this message translates to:
  /// **'Повернення в гру'**
  String get returningTitle;

  /// No description provided for @returningAction.
  ///
  /// In uk, this message translates to:
  /// **'Увійти'**
  String get returningAction;

  /// No description provided for @wrongPin.
  ///
  /// In uk, this message translates to:
  /// **'Невірний PIN. Лишилось спроб: {attemptsLeft}'**
  String wrongPin(int attemptsLeft);

  /// No description provided for @pinLocked.
  ///
  /// In uk, this message translates to:
  /// **'Забагато спроб. Спробуй через {minutes} хв або попроси організатора скинути PIN.'**
  String pinLocked(int minutes);

  /// No description provided for @noSuchLogin.
  ///
  /// In uk, this message translates to:
  /// **'Не знайшли такого гравця з PIN. Перевір ім\'я.'**
  String get noSuchLogin;

  /// No description provided for @networkError.
  ///
  /// In uk, this message translates to:
  /// **'Немає зв\'язку з сервером. Перевір інтернет.'**
  String get networkError;

  /// No description provided for @genericError.
  ///
  /// In uk, this message translates to:
  /// **'Щось пішло не так. Спробуй ще раз.'**
  String get genericError;

  /// No description provided for @membersTitle.
  ///
  /// In uk, this message translates to:
  /// **'Учасники'**
  String get membersTitle;

  /// No description provided for @pendingMembers.
  ///
  /// In uk, this message translates to:
  /// **'Чекають підтвердження'**
  String get pendingMembers;

  /// No description provided for @approve.
  ///
  /// In uk, this message translates to:
  /// **'Підтвердити'**
  String get approve;

  /// No description provided for @remove.
  ///
  /// In uk, this message translates to:
  /// **'Вилучити'**
  String get remove;

  /// No description provided for @you.
  ///
  /// In uk, this message translates to:
  /// **'ти'**
  String get you;

  /// No description provided for @signOut.
  ///
  /// In uk, this message translates to:
  /// **'Вийти'**
  String get signOut;

  /// No description provided for @organizerOwnLink.
  ///
  /// In uk, this message translates to:
  /// **'Ти вже увійшов на цьому пристрої як організатор. Щоб грати як учасник, відкрий посилання на іншому пристрої або в іншому браузері.'**
  String get organizerOwnLink;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'uk'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'uk':
      return AppLocalizationsUk();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
