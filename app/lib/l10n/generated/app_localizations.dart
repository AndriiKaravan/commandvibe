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

  /// No description provided for @groupCalendarButton.
  ///
  /// In uk, this message translates to:
  /// **'Календар гри'**
  String get groupCalendarButton;

  /// No description provided for @calendarTitle.
  ///
  /// In uk, this message translates to:
  /// **'Календар гри'**
  String get calendarTitle;

  /// No description provided for @gameSetupTitle.
  ///
  /// In uk, this message translates to:
  /// **'Налаштування гри'**
  String get gameSetupTitle;

  /// No description provided for @startDateLabel.
  ///
  /// In uk, this message translates to:
  /// **'Перший день: {date}'**
  String startDateLabel(String date);

  /// No description provided for @daysLabel.
  ///
  /// In uk, this message translates to:
  /// **'Тривалість: {count} дн.'**
  String daysLabel(int count);

  /// No description provided for @openTimeLabel.
  ///
  /// In uk, this message translates to:
  /// **'Час відкриття дня: {time}'**
  String openTimeLabel(String time);

  /// No description provided for @modeLabel.
  ///
  /// In uk, this message translates to:
  /// **'Як обираємо завдання'**
  String get modeLabel;

  /// No description provided for @modeAuto.
  ///
  /// In uk, this message translates to:
  /// **'Авто щодня'**
  String get modeAuto;

  /// No description provided for @modeRoulette.
  ///
  /// In uk, this message translates to:
  /// **'Рулетка'**
  String get modeRoulette;

  /// No description provided for @categoriesLabel.
  ///
  /// In uk, this message translates to:
  /// **'Теми завдань'**
  String get categoriesLabel;

  /// No description provided for @categoryHome.
  ///
  /// In uk, this message translates to:
  /// **'Вдома'**
  String get categoryHome;

  /// No description provided for @categoryStreet.
  ///
  /// In uk, this message translates to:
  /// **'Вулиця'**
  String get categoryStreet;

  /// No description provided for @categoryOffice.
  ///
  /// In uk, this message translates to:
  /// **'Офіс'**
  String get categoryOffice;

  /// No description provided for @categoryCheap.
  ///
  /// In uk, this message translates to:
  /// **'Дешево'**
  String get categoryCheap;

  /// No description provided for @categoryKids.
  ///
  /// In uk, this message translates to:
  /// **'З дітьми'**
  String get categoryKids;

  /// No description provided for @categoryWinter.
  ///
  /// In uk, this message translates to:
  /// **'Зима'**
  String get categoryWinter;

  /// No description provided for @categorySummer.
  ///
  /// In uk, this message translates to:
  /// **'Літо'**
  String get categorySummer;

  /// No description provided for @categoryTeam.
  ///
  /// In uk, this message translates to:
  /// **'Командне'**
  String get categoryTeam;

  /// No description provided for @categoryPair.
  ///
  /// In uk, this message translates to:
  /// **'Парне'**
  String get categoryPair;

  /// No description provided for @saveGame.
  ///
  /// In uk, this message translates to:
  /// **'Скласти календар'**
  String get saveGame;

  /// No description provided for @setupStartInPast.
  ///
  /// In uk, this message translates to:
  /// **'Перший день не може бути в минулому.'**
  String get setupStartInPast;

  /// No description provided for @setupInvalidDays.
  ///
  /// In uk, this message translates to:
  /// **'Тривалість — від 7 до 31 дня.'**
  String get setupInvalidDays;

  /// No description provided for @setupNoCategories.
  ///
  /// In uk, this message translates to:
  /// **'Обери хоча б одну тему.'**
  String get setupNoCategories;

  /// No description provided for @setupGameStarted.
  ///
  /// In uk, this message translates to:
  /// **'Гра вже почалась — налаштування змінити не можна.'**
  String get setupGameStarted;

  /// No description provided for @dayNumber.
  ///
  /// In uk, this message translates to:
  /// **'День {number}'**
  String dayNumber(int number);

  /// No description provided for @dayOpenState.
  ///
  /// In uk, this message translates to:
  /// **'відкрито'**
  String get dayOpenState;

  /// No description provided for @dayPickingState.
  ///
  /// In uk, this message translates to:
  /// **'обирає рулетка'**
  String get dayPickingState;

  /// No description provided for @otherTask.
  ///
  /// In uk, this message translates to:
  /// **'Інше'**
  String get otherTask;

  /// No description provided for @pickTask.
  ///
  /// In uk, this message translates to:
  /// **'З каталогу'**
  String get pickTask;

  /// No description provided for @ownTask.
  ///
  /// In uk, this message translates to:
  /// **'Своє'**
  String get ownTask;

  /// No description provided for @moveDayUp.
  ///
  /// In uk, this message translates to:
  /// **'Вище'**
  String get moveDayUp;

  /// No description provided for @moveDayDown.
  ///
  /// In uk, this message translates to:
  /// **'Нижче'**
  String get moveDayDown;

  /// No description provided for @editDayOpened.
  ///
  /// In uk, this message translates to:
  /// **'Цей день уже відкрився — змінити його не можна.'**
  String get editDayOpened;

  /// No description provided for @editNoMoreTasks.
  ///
  /// In uk, this message translates to:
  /// **'Більше немає нових завдань для цих тем.'**
  String get editNoMoreTasks;

  /// No description provided for @editTaskInGame.
  ///
  /// In uk, this message translates to:
  /// **'Це завдання вже є в календарі.'**
  String get editTaskInGame;

  /// No description provided for @calendarNotSetUp.
  ///
  /// In uk, this message translates to:
  /// **'Календар ще не складено.'**
  String get calendarNotSetUp;

  /// No description provided for @setUpGame.
  ///
  /// In uk, this message translates to:
  /// **'Налаштувати гру'**
  String get setUpGame;

  /// No description provided for @changeSettings.
  ///
  /// In uk, this message translates to:
  /// **'Змінити налаштування'**
  String get changeSettings;

  /// No description provided for @catalogSearchHint.
  ///
  /// In uk, this message translates to:
  /// **'Пошук завдання'**
  String get catalogSearchHint;

  /// No description provided for @catalogAllCategories.
  ///
  /// In uk, this message translates to:
  /// **'Усі теми'**
  String get catalogAllCategories;

  /// No description provided for @catalogNothingFound.
  ///
  /// In uk, this message translates to:
  /// **'Нічого не знайдено.'**
  String get catalogNothingFound;

  /// No description provided for @ownTaskTitle.
  ///
  /// In uk, this message translates to:
  /// **'Своє завдання'**
  String get ownTaskTitle;

  /// No description provided for @ownTaskNameLabel.
  ///
  /// In uk, this message translates to:
  /// **'Назва'**
  String get ownTaskNameLabel;

  /// No description provided for @ownTaskDescriptionLabel.
  ///
  /// In uk, this message translates to:
  /// **'Опис'**
  String get ownTaskDescriptionLabel;

  /// No description provided for @ownTaskNameEnLabel.
  ///
  /// In uk, this message translates to:
  /// **'Title (англійською, за бажанням)'**
  String get ownTaskNameEnLabel;

  /// No description provided for @ownTaskDescriptionEnLabel.
  ///
  /// In uk, this message translates to:
  /// **'Description (англійською, за бажанням)'**
  String get ownTaskDescriptionEnLabel;

  /// No description provided for @ownTaskNameInvalid.
  ///
  /// In uk, this message translates to:
  /// **'Введи назву до 60 символів.'**
  String get ownTaskNameInvalid;

  /// No description provided for @ownTaskDescriptionInvalid.
  ///
  /// In uk, this message translates to:
  /// **'Введи опис до 220 символів.'**
  String get ownTaskDescriptionInvalid;

  /// No description provided for @saveTask.
  ///
  /// In uk, this message translates to:
  /// **'Зберегти'**
  String get saveTask;

  /// No description provided for @retry.
  ///
  /// In uk, this message translates to:
  /// **'Повторити'**
  String get retry;

  /// No description provided for @todayTitle.
  ///
  /// In uk, this message translates to:
  /// **'Завдання дня'**
  String get todayTitle;

  /// No description provided for @todayNotConfigured.
  ///
  /// In uk, this message translates to:
  /// **'Гру ще не налаштовано.'**
  String get todayNotConfigured;

  /// No description provided for @todayBeforeStart.
  ///
  /// In uk, this message translates to:
  /// **'Гра починається {when}'**
  String todayBeforeStart(String when);

  /// No description provided for @todayWaitingMine.
  ///
  /// In uk, this message translates to:
  /// **'Твоя черга крутити рулетку!'**
  String get todayWaitingMine;

  /// No description provided for @todayWaitingOther.
  ///
  /// In uk, this message translates to:
  /// **'Рулетку крутить інший гравець. Якщо не встигне, крутне гра.'**
  String get todayWaitingOther;

  /// No description provided for @todaySpinUntil.
  ///
  /// In uk, this message translates to:
  /// **'Крутити до {time}'**
  String todaySpinUntil(String time);

  /// No description provided for @todaySpin.
  ///
  /// In uk, this message translates to:
  /// **'Крутити'**
  String get todaySpin;

  /// No description provided for @todaySpinning.
  ///
  /// In uk, this message translates to:
  /// **'Рулетка крутиться…'**
  String get todaySpinning;

  /// No description provided for @todayLoadingTask.
  ///
  /// In uk, this message translates to:
  /// **'Завантажуємо завдання…'**
  String get todayLoadingTask;

  /// No description provided for @todayFinished.
  ///
  /// In uk, this message translates to:
  /// **'Гру завершено. Дякуємо за гру!'**
  String get todayFinished;

  /// No description provided for @todayTurnOver.
  ///
  /// In uk, this message translates to:
  /// **'Рулетку вже крутнули.'**
  String get todayTurnOver;

  /// No description provided for @photosTitle.
  ///
  /// In uk, this message translates to:
  /// **'Фото дня'**
  String get photosTitle;

  /// No description provided for @photoSubmit.
  ///
  /// In uk, this message translates to:
  /// **'Виконати'**
  String get photoSubmit;

  /// No description provided for @photoDone.
  ///
  /// In uk, this message translates to:
  /// **'Виконано ✓'**
  String get photoDone;

  /// No description provided for @photoReplace.
  ///
  /// In uk, this message translates to:
  /// **'Замінити фото'**
  String get photoReplace;

  /// No description provided for @photoFromCamera.
  ///
  /// In uk, this message translates to:
  /// **'Зняти'**
  String get photoFromCamera;

  /// No description provided for @photoFromGallery.
  ///
  /// In uk, this message translates to:
  /// **'Обрати з галереї'**
  String get photoFromGallery;

  /// No description provided for @photoUploading.
  ///
  /// In uk, this message translates to:
  /// **'Надсилаємо…'**
  String get photoUploading;

  /// No description provided for @photoConfirmReplace.
  ///
  /// In uk, this message translates to:
  /// **'Замінити фото? Попереднє зникне'**
  String get photoConfirmReplace;

  /// No description provided for @photoReplaceYes.
  ///
  /// In uk, this message translates to:
  /// **'Замінити'**
  String get photoReplaceYes;

  /// No description provided for @photoCancel.
  ///
  /// In uk, this message translates to:
  /// **'Скасувати'**
  String get photoCancel;

  /// No description provided for @photoRetry.
  ///
  /// In uk, this message translates to:
  /// **'Спробувати ще раз'**
  String get photoRetry;

  /// No description provided for @photoClose.
  ///
  /// In uk, this message translates to:
  /// **'Закрити'**
  String get photoClose;

  /// No description provided for @photoErrTooLarge.
  ///
  /// In uk, this message translates to:
  /// **'Фото завелике — зніми ще раз або обери менше'**
  String get photoErrTooLarge;

  /// No description provided for @photoErrHeic.
  ///
  /// In uk, this message translates to:
  /// **'Формат HEIC поки не підтримується — зніми фото камерою або обери інше'**
  String get photoErrHeic;

  /// No description provided for @photoErrInvalid.
  ///
  /// In uk, this message translates to:
  /// **'Не вдалося прочитати фото — обери інше'**
  String get photoErrInvalid;

  /// No description provided for @photoErrRevealPassed.
  ///
  /// In uk, this message translates to:
  /// **'Фото цього дня вже відкрились — замінити не можна'**
  String get photoErrRevealPassed;

  /// No description provided for @photoErrDayClosed.
  ///
  /// In uk, this message translates to:
  /// **'Цей день уже не приймає фото'**
  String get photoErrDayClosed;

  /// No description provided for @photoErrHidden.
  ///
  /// In uk, this message translates to:
  /// **'Твоє фото приховав організатор — замінити не можна'**
  String get photoErrHidden;

  /// No description provided for @photoErrNetwork.
  ///
  /// In uk, this message translates to:
  /// **'Не вдалося надіслати — перевір з\'єднання і спробуй ще раз'**
  String get photoErrNetwork;

  /// No description provided for @photoBlurTitle.
  ///
  /// In uk, this message translates to:
  /// **'Виконай завдання — і побач одразу'**
  String get photoBlurTitle;

  /// No description provided for @photoBlurReveal.
  ///
  /// In uk, this message translates to:
  /// **'або відкриється {date} о {time}'**
  String photoBlurReveal(String date, String time);

  /// No description provided for @photoLateHint.
  ///
  /// In uk, this message translates to:
  /// **'Ще можна виконати — до кінця челенджу'**
  String get photoLateHint;

  /// No description provided for @photoCount.
  ///
  /// In uk, this message translates to:
  /// **'Виконали: {count}'**
  String photoCount(int count);

  /// No description provided for @photoNoOthers.
  ///
  /// In uk, this message translates to:
  /// **'Поки ніхто не виконав'**
  String get photoNoOthers;

  /// No description provided for @photoReport.
  ///
  /// In uk, this message translates to:
  /// **'Поскаржитись'**
  String get photoReport;

  /// No description provided for @photoReasonInappropriate.
  ///
  /// In uk, this message translates to:
  /// **'Недоречне фото'**
  String get photoReasonInappropriate;

  /// No description provided for @photoReasonNotTask.
  ///
  /// In uk, this message translates to:
  /// **'Не за завданням'**
  String get photoReasonNotTask;

  /// No description provided for @photoReasonOther.
  ///
  /// In uk, this message translates to:
  /// **'Інше'**
  String get photoReasonOther;

  /// No description provided for @photoReported.
  ///
  /// In uk, this message translates to:
  /// **'Скаргу надіслано'**
  String get photoReported;

  /// No description provided for @photoTakenEarlier.
  ///
  /// In uk, this message translates to:
  /// **'Знято раніше, ніж відкрито завдання'**
  String get photoTakenEarlier;

  /// No description provided for @photoSourceCamera.
  ///
  /// In uk, this message translates to:
  /// **'Камера (підказка)'**
  String get photoSourceCamera;

  /// No description provided for @photoSourceGallery.
  ///
  /// In uk, this message translates to:
  /// **'Галерея (підказка)'**
  String get photoSourceGallery;

  /// No description provided for @photoHide.
  ///
  /// In uk, this message translates to:
  /// **'Приховати'**
  String get photoHide;

  /// No description provided for @photoRestore.
  ///
  /// In uk, this message translates to:
  /// **'Повернути'**
  String get photoRestore;

  /// No description provided for @photoDismiss.
  ///
  /// In uk, this message translates to:
  /// **'Відхилити скаргу'**
  String get photoDismiss;

  /// No description provided for @photoHiddenBadge.
  ///
  /// In uk, this message translates to:
  /// **'Приховано організатором'**
  String get photoHiddenBadge;

  /// No description provided for @photoOpenComplaints.
  ///
  /// In uk, this message translates to:
  /// **'Скарг: {count}'**
  String photoOpenComplaints(int count);

  /// No description provided for @photoViewerFailed.
  ///
  /// In uk, this message translates to:
  /// **'Не вдалося завантажити фото'**
  String get photoViewerFailed;

  /// No description provided for @complaintsTitle.
  ///
  /// In uk, this message translates to:
  /// **'Скарги'**
  String get complaintsTitle;

  /// No description provided for @complaintsButton.
  ///
  /// In uk, this message translates to:
  /// **'Скарги ({count})'**
  String complaintsButton(int count);

  /// No description provided for @complaintsEmpty.
  ///
  /// In uk, this message translates to:
  /// **'Скарг немає'**
  String get complaintsEmpty;

  /// No description provided for @complaintsDay.
  ///
  /// In uk, this message translates to:
  /// **'День {day}'**
  String complaintsDay(int day);

  /// No description provided for @photoOpen.
  ///
  /// In uk, this message translates to:
  /// **'Відкрити фото'**
  String get photoOpen;

  /// No description provided for @myGroupsTitle.
  ///
  /// In uk, this message translates to:
  /// **'Мої групи'**
  String get myGroupsTitle;

  /// No description provided for @myGroupsFailed.
  ///
  /// In uk, this message translates to:
  /// **'Не вдалося завантажити групи'**
  String get myGroupsFailed;

  /// No description provided for @myGroupsRetry.
  ///
  /// In uk, this message translates to:
  /// **'Спробувати ще раз'**
  String get myGroupsRetry;

  /// No description provided for @myGroupsMembers.
  ///
  /// In uk, this message translates to:
  /// **'Учасників: {count}'**
  String myGroupsMembers(int count);

  /// No description provided for @groupStatusDraft.
  ///
  /// In uk, this message translates to:
  /// **'Налаштування'**
  String get groupStatusDraft;

  /// No description provided for @groupStatusActive.
  ///
  /// In uk, this message translates to:
  /// **'Гра триває'**
  String get groupStatusActive;

  /// No description provided for @groupStatusFinished.
  ///
  /// In uk, this message translates to:
  /// **'Завершено'**
  String get groupStatusFinished;

  /// No description provided for @groupInviteButton.
  ///
  /// In uk, this message translates to:
  /// **'Запросити учасників'**
  String get groupInviteButton;

  /// No description provided for @inviteRotateWarning.
  ///
  /// In uk, this message translates to:
  /// **'Створимо нове посилання, а старе перестане діяти. Учасники, які вже в групі, зможуть увійти знову лише за новим посиланням.'**
  String get inviteRotateWarning;

  /// No description provided for @inviteRotateButton.
  ///
  /// In uk, this message translates to:
  /// **'Створити нове посилання'**
  String get inviteRotateButton;

  /// No description provided for @inviteFailed.
  ///
  /// In uk, this message translates to:
  /// **'Не вдалося створити посилання — спробуй ще раз'**
  String get inviteFailed;

  /// No description provided for @tabToday.
  ///
  /// In uk, this message translates to:
  /// **'Сьогодні'**
  String get tabToday;

  /// No description provided for @tabDays.
  ///
  /// In uk, this message translates to:
  /// **'Календар'**
  String get tabDays;

  /// No description provided for @tabFeed.
  ///
  /// In uk, this message translates to:
  /// **'Стрічка'**
  String get tabFeed;

  /// No description provided for @tabRating.
  ///
  /// In uk, this message translates to:
  /// **'Рейтинг'**
  String get tabRating;

  /// No description provided for @tabMe.
  ///
  /// In uk, this message translates to:
  /// **'Я'**
  String get tabMe;

  /// No description provided for @tabGroup.
  ///
  /// In uk, this message translates to:
  /// **'Група'**
  String get tabGroup;

  /// No description provided for @avatarPickerTitle.
  ///
  /// In uk, this message translates to:
  /// **'Обери аватар'**
  String get avatarPickerTitle;

  /// No description provided for @avatarUseInitials.
  ///
  /// In uk, this message translates to:
  /// **'Лише ініціали'**
  String get avatarUseInitials;

  /// No description provided for @avatarSaveFailed.
  ///
  /// In uk, this message translates to:
  /// **'Не вдалося зберегти — спробуй ще раз'**
  String get avatarSaveFailed;

  /// No description provided for @progressTitle.
  ///
  /// In uk, this message translates to:
  /// **'Хід дня'**
  String get progressTitle;

  /// No description provided for @progressCount.
  ///
  /// In uk, this message translates to:
  /// **'{done} з {total} уже виконали'**
  String progressCount(int done, int total);

  /// No description provided for @progressGoalHint.
  ///
  /// In uk, this message translates to:
  /// **'Спільна ціль — 80% групи'**
  String get progressGoalHint;

  /// No description provided for @progressGoalReached.
  ///
  /// In uk, this message translates to:
  /// **'Спільна ціль досягнута!'**
  String get progressGoalReached;

  /// No description provided for @myPlaceTitle.
  ///
  /// In uk, this message translates to:
  /// **'Ти {rank}-й'**
  String myPlaceTitle(int rank);

  /// No description provided for @myPlaceGap.
  ///
  /// In uk, this message translates to:
  /// **'до {rank}-го — {points} б.'**
  String myPlaceGap(int rank, int points);

  /// No description provided for @myPlaceLeader.
  ///
  /// In uk, this message translates to:
  /// **'Ти попереду всіх'**
  String get myPlaceLeader;

  /// No description provided for @myPlaceLeaders.
  ///
  /// In uk, this message translates to:
  /// **'Лідери'**
  String get myPlaceLeaders;

  /// No description provided for @pointsShort.
  ///
  /// In uk, this message translates to:
  /// **'{points} б.'**
  String pointsShort(int points);

  /// No description provided for @eventsTitle.
  ///
  /// In uk, this message translates to:
  /// **'Події'**
  String get eventsTitle;

  /// No description provided for @eventPhotoSent.
  ///
  /// In uk, this message translates to:
  /// **'Нове фото: {name}'**
  String eventPhotoSent(String name);

  /// No description provided for @eventDayOpened.
  ///
  /// In uk, this message translates to:
  /// **'Відкрилось завдання дня {day}'**
  String eventDayOpened(int day);

  /// No description provided for @eventPhotosRevealed.
  ///
  /// In uk, this message translates to:
  /// **'Фото дня {day} відкрились'**
  String eventPhotosRevealed(int day);

  /// No description provided for @daySheetTitle.
  ///
  /// In uk, this message translates to:
  /// **'День {day}'**
  String daySheetTitle(int day);

  /// No description provided for @dayStateClosed.
  ///
  /// In uk, this message translates to:
  /// **'Ще зачинено'**
  String get dayStateClosed;

  /// No description provided for @dayStateOpen.
  ///
  /// In uk, this message translates to:
  /// **'Відкрито'**
  String get dayStateOpen;

  /// No description provided for @dayStateCanDo.
  ///
  /// In uk, this message translates to:
  /// **'Ще можна виконати'**
  String get dayStateCanDo;

  /// No description provided for @dayStateDone.
  ///
  /// In uk, this message translates to:
  /// **'Виконано'**
  String get dayStateDone;

  /// No description provided for @dayStateRevealed.
  ///
  /// In uk, this message translates to:
  /// **'Фото відкрито'**
  String get dayStateRevealed;

  /// No description provided for @daysNoGame.
  ///
  /// In uk, this message translates to:
  /// **'Гру ще не налаштовано'**
  String get daysNoGame;

  /// No description provided for @daysTaskLabel.
  ///
  /// In uk, this message translates to:
  /// **'Завдання дня'**
  String get daysTaskLabel;

  /// No description provided for @feedEmpty.
  ///
  /// In uk, this message translates to:
  /// **'Поки немає фото'**
  String get feedEmpty;

  /// No description provided for @feedFilterAll.
  ///
  /// In uk, this message translates to:
  /// **'Усі'**
  String get feedFilterAll;

  /// No description provided for @feedFilterMine.
  ///
  /// In uk, this message translates to:
  /// **'Мої'**
  String get feedFilterMine;

  /// No description provided for @feedFilterDay.
  ///
  /// In uk, this message translates to:
  /// **'День'**
  String get feedFilterDay;

  /// No description provided for @feedFilterMember.
  ///
  /// In uk, this message translates to:
  /// **'Учасник'**
  String get feedFilterMember;

  /// No description provided for @feedDayTask.
  ///
  /// In uk, this message translates to:
  /// **'День {day} · {task}'**
  String feedDayTask(int day, String task);

  /// No description provided for @ratingEmpty.
  ///
  /// In uk, this message translates to:
  /// **'Поки немає балів'**
  String get ratingEmpty;

  /// No description provided for @profileDays.
  ///
  /// In uk, this message translates to:
  /// **'Виконано днів: {done} з {total}'**
  String profileDays(int done, int total);

  /// No description provided for @profileChangeAvatar.
  ///
  /// In uk, this message translates to:
  /// **'Змінити аватар'**
  String get profileChangeAvatar;

  /// No description provided for @profileChangePin.
  ///
  /// In uk, this message translates to:
  /// **'Змінити PIN'**
  String get profileChangePin;
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
