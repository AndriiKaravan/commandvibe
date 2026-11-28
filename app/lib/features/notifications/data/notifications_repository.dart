import 'package:commandvibe/core/api/api_client.dart';
import 'package:commandvibe/features/notifications/data/notifications_models.dart';

abstract interface class NotificationsRepository {
  Future<NotificationsPage> list(String groupId);

  /// Marks the given entries read, or all of them when [ids] is null.
  Future<void> markRead(String groupId, {List<String>? ids});

  Future<NotificationSettings> loadSettings(String groupId);

  /// Changes only the switches that are given.
  Future<void> saveSettings(String groupId, {bool? tasks, bool? social});
}

class ApiNotificationsRepository implements NotificationsRepository {
  ApiNotificationsRepository(this._api);

  final ApiClient _api;

  @override
  Future<NotificationsPage> list(String groupId) async =>
      NotificationsPage.fromJson(
        await _api.get('/groups/$groupId/notifications')
            as Map<String, dynamic>,
      );

  @override
  Future<void> markRead(String groupId, {List<String>? ids}) async {
    await _api.post('/groups/$groupId/notifications/read', body: {'ids': ?ids});
  }

  @override
  Future<NotificationSettings> loadSettings(String groupId) async =>
      NotificationSettings.fromJson(
        await _api.get('/groups/$groupId/me/notification-settings')
            as Map<String, dynamic>,
      );

  @override
  Future<void> saveSettings(String groupId, {bool? tasks, bool? social}) async {
    await _api.put(
      '/groups/$groupId/me/notification-settings',
      body: {'tasks': ?tasks, 'social': ?social},
    );
  }
}
