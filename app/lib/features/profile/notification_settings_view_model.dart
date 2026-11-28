import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/push/push_gateway.dart';
import 'package:commandvibe/features/notifications/data/notifications_repository.dart';
import 'package:flutter/foundation.dart';

/// Where push stands on this device, as the settings card tells it.
enum PushState {
  /// Not read yet.
  unknown,

  /// This device or browser cannot receive push.
  unsupported,

  /// iPhone browsers only allow push for an app added to the home screen.
  needsHomeScreen,

  /// The build has no web push key.
  notConfigured,

  /// The person blocked notifications in the system or browser.
  denied,

  /// Not asked yet, or asked and not granted.
  off,

  on,
}

/// The switches under "Me" and the push permission, with optimistic changes that roll back.
class NotificationSettingsViewModel extends ChangeNotifier {
  NotificationSettingsViewModel(
    this._repository,
    this._push, {
    required this.groupId,
    required Future<void> Function() syncToken,
  }) : _syncToken = syncToken;

  final NotificationsRepository _repository;
  final PushService _push;
  final String groupId;
  final Future<void> Function() _syncToken;

  PushState _pushState = PushState.unknown;
  bool _tasks = true;
  bool _social = true;
  bool _playing = true;
  bool _failed = false;
  bool _disposed = false;

  PushState get pushState => _pushState;
  bool get tasks => _tasks;
  bool get social => _social;

  /// False for an organizer who does not play: they only get the push state.
  bool get playing => _playing;

  /// True when the last change did not reach the server.
  bool get failed => _failed;

  Future<void> load() async {
    await _readPush();
    try {
      final settings = await _repository.loadSettings(groupId);
      _tasks = settings.tasks;
      _social = settings.social;
      _playing = settings.playing;
      _failed = false;
    } on ApiException {
      _failed = true;
    } on NetworkException {
      _failed = true;
    }
    _notify();
  }

  Future<void> _readPush() async {
    final support = await _push.support();
    _pushState = switch (support) {
      PushSupport.unsupportedPlatform ||
      PushSupport.unsupportedBrowser => PushState.unsupported,
      PushSupport.needsHomeScreen => PushState.needsHomeScreen,
      PushSupport.notConfigured => PushState.notConfigured,
      PushSupport.supported => _fromPermission(await _push.permission()),
    };
    _notify();
  }

  static PushState _fromPermission(PushPermission permission) =>
      switch (permission) {
        PushPermission.granted || PushPermission.provisional => PushState.on,
        PushPermission.denied => PushState.denied,
        PushPermission.notDetermined => PushState.off,
      };

  /// Asks for permission; must run from a tap, which browsers require.
  Future<void> enablePush() async {
    final permission = await _push.requestPermission();
    _pushState = _fromPermission(permission);
    _notify();
    if (_pushState == PushState.on) {
      await _syncToken();
    }
  }

  Future<void> setTasks(bool value) => _change(
    apply: () => _tasks = value,
    undo: () => _tasks = !value,
    save: () => _repository.saveSettings(groupId, tasks: value),
  );

  Future<void> setSocial(bool value) => _change(
    apply: () => _social = value,
    undo: () => _social = !value,
    save: () => _repository.saveSettings(groupId, social: value),
  );

  Future<void> _change({
    required VoidCallback apply,
    required VoidCallback undo,
    required Future<void> Function() save,
  }) async {
    apply();
    _failed = false;
    _notify();
    try {
      await save();
    } on ApiException {
      undo();
      _failed = true;
    } on NetworkException {
      undo();
      _failed = true;
    }
    _notify();
  }

  void _notify() {
    if (!_disposed) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
