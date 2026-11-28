// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Ukrainian (`uk`).
class AppLocalizationsUk extends AppLocalizations {
  AppLocalizationsUk([String locale = 'uk']) : super(locale);

  @override
  String get appTitle => 'CommandVibe';

  @override
  String get welcomeTitle => 'Фото-челендж для своїх';

  @override
  String get welcomeBody =>
      'Щодня нове завдання, фото друзів відкриваються, коли виконаєш і ти.';

  @override
  String get organizerSignIn => 'Я організатор';

  @override
  String get haveInvite => 'У мене є посилання-запрошення';

  @override
  String get signInWithGoogle => 'Увійти через Google';

  @override
  String get signInFailed => 'Не вдалося увійти. Спробуй ще раз.';

  @override
  String get openInBrowserHint =>
      'Якщо вхід не відкривається, відкрий сторінку у браузері.';

  @override
  String get createGroupTitle => 'Нова група';

  @override
  String get groupNameLabel => 'Назва групи';

  @override
  String get playsTooLabel => 'Я теж граю';

  @override
  String get approveNewLabel => 'Підтверджувати нових учасників';

  @override
  String get createGroupAction => 'Створити';

  @override
  String get inviteTitle => 'Запроси учасників';

  @override
  String get inviteBody =>
      'Надішли це посилання в чат групи. Хто відкриє — вводить ім\'я і вже в грі.';

  @override
  String get shareInvite => 'Поділитися посиланням';

  @override
  String get copyInvite => 'Скопіювати';

  @override
  String get copied => 'Скопійовано';

  @override
  String get toGroup => 'До групи';

  @override
  String joinTitle(String groupName) {
    return 'Вас запросили в «$groupName»';
  }

  @override
  String joinMembers(int count) {
    return 'Уже в грі: $count';
  }

  @override
  String get yourNameLabel => 'Твоє ім\'я або нікнейм';

  @override
  String get joinAction => 'Увійти в гру';

  @override
  String get alreadyPlaying => 'Я вже в грі';

  @override
  String get nameTaken =>
      'Таке ім\'я вже є в групі. Обери інше або натисни «Я вже в грі».';

  @override
  String get inviteClosed =>
      'Посилання більше не діє. Попроси організатора надіслати нове.';

  @override
  String get groupFull => 'У групі вже немає місць.';

  @override
  String get invalidName => 'Введи ім\'я до 40 символів.';

  @override
  String get pendingApproval => 'Чекаємо підтвердження організатора.';

  @override
  String get pinTitle => 'Придумай PIN';

  @override
  String get pinBody => '4 цифри, щоб увійти з іншого пристрою.';

  @override
  String get pinLabel => 'PIN';

  @override
  String get pinSave => 'Зберегти';

  @override
  String get pinSkip => 'Пізніше';

  @override
  String get pinInvalid => 'PIN — рівно 4 цифри.';

  @override
  String get returningTitle => 'Повернення в гру';

  @override
  String get returningAction => 'Увійти';

  @override
  String wrongPin(int attemptsLeft) {
    return 'Невірний PIN. Лишилось спроб: $attemptsLeft';
  }

  @override
  String pinLocked(int minutes) {
    return 'Забагато спроб. Спробуй через $minutes хв або попроси організатора скинути PIN.';
  }

  @override
  String get noSuchLogin => 'Не знайшли такого гравця з PIN. Перевір ім\'я.';

  @override
  String get networkError => 'Немає зв\'язку з сервером. Перевір інтернет.';

  @override
  String get genericError => 'Щось пішло не так. Спробуй ще раз.';

  @override
  String get membersTitle => 'Учасники';

  @override
  String get pendingMembers => 'Чекають підтвердження';

  @override
  String get approve => 'Підтвердити';

  @override
  String get remove => 'Вилучити';

  @override
  String get you => 'ти';

  @override
  String get signOut => 'Вийти';

  @override
  String get organizerOwnLink =>
      'Ти вже увійшов на цьому пристрої як організатор. Щоб грати як учасник, відкрий посилання на іншому пристрої або в іншому браузері.';

  @override
  String get groupCalendarButton => 'Календар гри';

  @override
  String get calendarTitle => 'Календар гри';

  @override
  String get gameSetupTitle => 'Налаштування гри';

  @override
  String startDateLabel(String date) {
    return 'Перший день: $date';
  }

  @override
  String daysLabel(int count) {
    return 'Тривалість: $count дн.';
  }

  @override
  String openTimeLabel(String time) {
    return 'Час відкриття дня: $time';
  }

  @override
  String get modeLabel => 'Як обираємо завдання';

  @override
  String get modeAuto => 'Авто щодня';

  @override
  String get modeRoulette => 'Рулетка';

  @override
  String get categoriesLabel => 'Теми завдань';

  @override
  String get categoryHome => 'Вдома';

  @override
  String get categoryStreet => 'Вулиця';

  @override
  String get categoryOffice => 'Офіс';

  @override
  String get categoryCheap => 'Дешево';

  @override
  String get categoryKids => 'З дітьми';

  @override
  String get categoryWinter => 'Зима';

  @override
  String get categorySummer => 'Літо';

  @override
  String get categoryTeam => 'Командне';

  @override
  String get categoryPair => 'Парне';

  @override
  String get saveGame => 'Скласти календар';

  @override
  String get setupStartInPast => 'Перший день не може бути в минулому.';

  @override
  String get setupInvalidDays => 'Тривалість — від 7 до 31 дня.';

  @override
  String get setupNoCategories => 'Обери хоча б одну тему.';

  @override
  String get setupGameStarted =>
      'Гра вже почалась — налаштування змінити не можна.';

  @override
  String dayNumber(int number) {
    return 'День $number';
  }

  @override
  String get dayOpenState => 'відкрито';

  @override
  String get dayPickingState => 'обирає рулетка';

  @override
  String get otherTask => 'Інше';

  @override
  String get pickTask => 'З каталогу';

  @override
  String get ownTask => 'Своє';

  @override
  String get moveDayUp => 'Вище';

  @override
  String get moveDayDown => 'Нижче';

  @override
  String get editDayOpened => 'Цей день уже відкрився — змінити його не можна.';

  @override
  String get editNoMoreTasks => 'Більше немає нових завдань для цих тем.';

  @override
  String get editTaskInGame => 'Це завдання вже є в календарі.';

  @override
  String get calendarNotSetUp => 'Календар ще не складено.';

  @override
  String get setUpGame => 'Налаштувати гру';

  @override
  String get changeSettings => 'Змінити налаштування';

  @override
  String get catalogSearchHint => 'Пошук завдання';

  @override
  String get catalogAllCategories => 'Усі теми';

  @override
  String get catalogNothingFound => 'Нічого не знайдено.';

  @override
  String get ownTaskTitle => 'Своє завдання';

  @override
  String get ownTaskNameLabel => 'Назва';

  @override
  String get ownTaskDescriptionLabel => 'Опис';

  @override
  String get ownTaskNameEnLabel => 'Title (англійською, за бажанням)';

  @override
  String get ownTaskDescriptionEnLabel =>
      'Description (англійською, за бажанням)';

  @override
  String get ownTaskNameInvalid => 'Введи назву до 60 символів.';

  @override
  String get ownTaskDescriptionInvalid => 'Введи опис до 220 символів.';

  @override
  String get saveTask => 'Зберегти';

  @override
  String get retry => 'Повторити';

  @override
  String get todayTitle => 'Завдання дня';

  @override
  String get todayNotConfigured => 'Гру ще не налаштовано.';

  @override
  String todayBeforeStart(String when) {
    return 'Гра починається $when';
  }

  @override
  String get todayWaitingMine => 'Твоя черга крутити рулетку!';

  @override
  String get todayWaitingOther =>
      'Рулетку крутить інший гравець. Якщо не встигне, крутне гра.';

  @override
  String todaySpinUntil(String time) {
    return 'Крутити до $time';
  }

  @override
  String get todaySpin => 'Крутити';

  @override
  String get todaySpinning => 'Рулетка крутиться…';

  @override
  String get todayLoadingTask => 'Завантажуємо завдання…';

  @override
  String get todayFinished => 'Гру завершено. Дякуємо за гру!';

  @override
  String get todayTurnOver => 'Рулетку вже крутнули.';

  @override
  String get photosTitle => 'Фото дня';

  @override
  String get photoSubmit => 'Виконати';

  @override
  String get photoDone => 'Виконано ✓';

  @override
  String get photoReplace => 'Замінити фото';

  @override
  String get photoFromCamera => 'Зняти';

  @override
  String get photoFromGallery => 'Обрати з галереї';

  @override
  String get photoUploading => 'Надсилаємо…';

  @override
  String get photoConfirmReplace => 'Замінити фото? Попереднє зникне';

  @override
  String get photoReplaceYes => 'Замінити';

  @override
  String get photoCancel => 'Скасувати';

  @override
  String get photoRetry => 'Спробувати ще раз';

  @override
  String get photoClose => 'Закрити';

  @override
  String get photoErrTooLarge => 'Фото завелике — зніми ще раз або обери менше';

  @override
  String get photoErrHeic =>
      'Формат HEIC поки не підтримується — зніми фото камерою або обери інше';

  @override
  String get photoErrInvalid => 'Не вдалося прочитати фото — обери інше';

  @override
  String get photoErrRevealPassed =>
      'Фото цього дня вже відкрились — замінити не можна';

  @override
  String get photoErrDayClosed => 'Цей день уже не приймає фото';

  @override
  String get photoErrHidden =>
      'Твоє фото приховав організатор — замінити не можна';

  @override
  String get photoErrNetwork =>
      'Не вдалося надіслати — перевір з\'єднання і спробуй ще раз';

  @override
  String get photoBlurTitle => 'Виконай завдання — і побач одразу';

  @override
  String photoBlurReveal(String date, String time) {
    return 'або відкриється $date о $time';
  }

  @override
  String get photoLateHint => 'Ще можна виконати — до кінця челенджу';

  @override
  String photoCount(int count) {
    return 'Виконали: $count';
  }

  @override
  String get photoNoOthers => 'Поки ніхто не виконав';

  @override
  String get photoReport => 'Поскаржитись';

  @override
  String get photoReasonInappropriate => 'Недоречне фото';

  @override
  String get photoReasonNotTask => 'Не за завданням';

  @override
  String get photoReasonOther => 'Інше';

  @override
  String get photoReported => 'Скаргу надіслано';

  @override
  String get photoTakenEarlier => 'Знято раніше, ніж відкрито завдання';

  @override
  String get photoSourceCamera => 'Камера (підказка)';

  @override
  String get photoSourceGallery => 'Галерея (підказка)';

  @override
  String get photoHide => 'Приховати';

  @override
  String get photoRestore => 'Повернути';

  @override
  String get photoDismiss => 'Відхилити скаргу';

  @override
  String get photoHiddenBadge => 'Приховано організатором';

  @override
  String photoOpenComplaints(int count) {
    return 'Скарг: $count';
  }

  @override
  String get photoViewerFailed => 'Не вдалося завантажити фото';

  @override
  String get complaintsTitle => 'Скарги';

  @override
  String complaintsButton(int count) {
    return 'Скарги ($count)';
  }

  @override
  String get complaintsEmpty => 'Скарг немає';

  @override
  String complaintsDay(int day) {
    return 'День $day';
  }

  @override
  String get photoOpen => 'Відкрити фото';

  @override
  String get myGroupsTitle => 'Мої групи';

  @override
  String get myGroupsFailed => 'Не вдалося завантажити групи';

  @override
  String get myGroupsRetry => 'Спробувати ще раз';

  @override
  String myGroupsMembers(int count) {
    return 'Учасників: $count';
  }

  @override
  String get groupStatusDraft => 'Налаштування';

  @override
  String get groupStatusActive => 'Гра триває';

  @override
  String get groupStatusFinished => 'Завершено';

  @override
  String get groupInviteButton => 'Запросити учасників';

  @override
  String get inviteRotateWarning =>
      'Створимо нове посилання, а старе перестане діяти. Учасники, які вже в групі, зможуть увійти знову лише за новим посиланням.';

  @override
  String get inviteRotateButton => 'Створити нове посилання';

  @override
  String get inviteFailed => 'Не вдалося створити посилання — спробуй ще раз';

  @override
  String get tabToday => 'Сьогодні';

  @override
  String get tabDays => 'Календар';

  @override
  String get tabFeed => 'Стрічка';

  @override
  String get tabRating => 'Рейтинг';

  @override
  String get tabMe => 'Я';

  @override
  String get tabGroup => 'Група';
}
