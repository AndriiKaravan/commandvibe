import 'package:http/http.dart' as http;

typedef AccessTokenProvider =
    Future<String?> Function({required bool forceRefresh});

/// Adds the session's access token to each request; on `401` asks for a renewed
/// token once and repeats the call. Only for requests whose body can be re-sent.
class SessionHttpClient extends http.BaseClient {
  SessionHttpClient(this._inner, {required AccessTokenProvider accessToken})
    : _accessToken = accessToken;

  final http.Client _inner;
  final AccessTokenProvider _accessToken;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final body = request is http.Request ? request.bodyBytes : null;
    final first = await _inner.send(await _signed(request, body, false));
    if (first.statusCode != 401) {
      return first;
    }
    await first.stream.drain<void>();
    return _inner.send(await _signed(request, body, true));
  }

  Future<http.BaseRequest> _signed(
    http.BaseRequest original,
    List<int>? body,
    bool forceRefresh,
  ) async {
    final copy = http.Request(original.method, original.url)
      ..headers.addAll(original.headers)
      ..followRedirects = original.followRedirects;
    if (body != null) {
      copy.bodyBytes = body;
    }
    final token = await _accessToken(forceRefresh: forceRefresh);
    copy.headers.remove('authorization');
    if (token != null) {
      copy.headers['authorization'] = 'Bearer $token';
    }
    return copy;
  }
}
