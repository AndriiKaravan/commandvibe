import 'package:commandvibe/core/platform/invite_link_source_io.dart'
    if (dart.library.js_interop) 'package:commandvibe/core/platform/invite_link_source_web.dart';

final _tokenPattern = RegExp(r'^[A-Za-z0-9_-]{16,64}$');

bool _isOurHost(String host) =>
    host == 'commandvibe.karavanstudio.dev' ||
    host == 'localhost' ||
    host == '127.0.0.1' ||
    host == 'commandvibe-ks.web.app' ||
    (host.startsWith('commandvibe-ks--') && host.endsWith('.web.app'));

/// Invite token of `/join?t=<token>` (web) or `/j/<token>` (App/Universal Link), or null.
String? inviteTokenFrom(Uri uri) {
  if (!_isOurHost(uri.host)) {
    return null;
  }
  final segments = uri.pathSegments;
  final token = switch (segments) {
    ['join'] => uri.queryParameters['t'],
    ['j', final value] => value,
    _ => null,
  };
  return token != null && _tokenPattern.hasMatch(token) ? token : null;
}

/// Invite links that open the app: the one it started with and later ones.
abstract interface class InviteLinkSource {
  factory InviteLinkSource.platform() => createPlatformInviteLinkSource();

  Future<String?> initialToken();

  Stream<String> get tokens;
}
