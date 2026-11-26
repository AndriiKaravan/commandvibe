import 'package:commandvibe/core/platform/invite_link_source.dart';

/// The web app is opened at `/join?t=<token>` by the server's invite page.
class UrlInviteSource implements InviteLinkSource {
  @override
  Future<String?> initialToken() async => inviteTokenFrom(Uri.base);

  @override
  Stream<String> get tokens => const Stream.empty();
}

InviteLinkSource createPlatformInviteLinkSource() => UrlInviteSource();
