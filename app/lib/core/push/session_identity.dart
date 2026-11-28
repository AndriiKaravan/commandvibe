import 'dart:async';
import 'dart:convert';

import 'package:commandvibe/core/platform/observed_session_store.dart';
import 'package:commandvibe/core/platform/session_store.dart';

Map<String, dynamic>? _claimsOf(StoredSession? session) {
  if (session == null) {
    return null;
  }
  try {
    final parts = session.accessToken.split('.');
    return jsonDecode(
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
        )
        as Map<String, dynamic>;
  } on Object {
    return null;
  }
}

/// Who is signed in, read from the access token's claims (not verified here;
/// the server verifies every request). Null when signed out or unreadable.
String? accountOf(StoredSession? session) {
  final subject = _claimsOf(session)?['sub'];
  return subject is String ? '${session!.kind}:$subject' : null;
}

/// The member a member session plays as; null for an organizer, who may not play.
String? memberIdOf(StoredSession? session) {
  final subject = _claimsOf(session)?['sub'];
  return session?.kind == 'member' && subject is String ? subject : null;
}

/// The signed-in account over time; a refresh of the same account is not a change.
Stream<String?> signedInAccounts(ObservedSessionStore store) {
  late StreamController<String?> controller;
  Object unset = Object();
  Object? last = unset;
  Future<void> emit() async {
    final account = accountOf(await store.read());
    if (!controller.isClosed && account != last) {
      last = account;
      controller.add(account);
    }
  }

  controller = StreamController<String?>(
    onListen: () {
      store.addListener(emit);
      unawaited(emit());
    },
    onCancel: () {
      store.removeListener(emit);
      return controller.close();
    },
  );
  return controller.stream;
}
