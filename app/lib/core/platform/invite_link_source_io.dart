import 'package:app_links/app_links.dart';
import 'package:commandvibe/core/platform/invite_link_source.dart';

/// App Links (Android) and Universal Links (iOS) to `/j/<token>`.
class AppLinksInviteSource implements InviteLinkSource {
  AppLinksInviteSource([AppLinks? links]) : _links = links ?? AppLinks();

  final AppLinks _links;

  @override
  Future<String?> initialToken() async {
    final uri = await _links.getInitialLink();
    return uri == null ? null : inviteTokenFrom(uri);
  }

  @override
  Stream<String> get tokens => _links.uriLinkStream
      .map(inviteTokenFrom)
      .where((t) => t != null)
      .cast<String>();
}

InviteLinkSource createPlatformInviteLinkSource() => AppLinksInviteSource();
