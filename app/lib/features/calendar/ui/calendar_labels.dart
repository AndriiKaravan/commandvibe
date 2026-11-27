import 'package:commandvibe/features/calendar/data/calendar_models.dart';
import 'package:commandvibe/features/calendar/ui/calendar_editor_view_model.dart';
import 'package:commandvibe/features/calendar/ui/game_setup_view_model.dart';
import 'package:commandvibe/l10n/generated/app_localizations.dart';

/// User-facing names of the calendar's enums, in the app language.
extension CalendarLabels on AppLocalizations {
  String category(GameCategory category) => switch (category) {
    GameCategory.home => categoryHome,
    GameCategory.street => categoryStreet,
    GameCategory.office => categoryOffice,
    GameCategory.cheap => categoryCheap,
    GameCategory.kids => categoryKids,
    GameCategory.winter => categoryWinter,
    GameCategory.summer => categorySummer,
    GameCategory.team => categoryTeam,
    GameCategory.pair => categoryPair,
  };

  String setupError(SetupError error) => switch (error) {
    SetupError.startInPast => setupStartInPast,
    SetupError.invalidDays => setupInvalidDays,
    SetupError.noCategories => setupNoCategories,
    SetupError.gameStarted => setupGameStarted,
    SetupError.failed => genericError,
  };

  String editorMessage(EditorMessage message) => switch (message) {
    EditorMessage.dayOpened => editDayOpened,
    EditorMessage.noMoreTasks => editNoMoreTasks,
    EditorMessage.taskInGame => editTaskInGame,
    EditorMessage.failed => genericError,
  };
}
