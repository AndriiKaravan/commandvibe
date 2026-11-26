/// A non-2xx answer of the CommandVibe server.
class ApiException implements Exception {
  ApiException(this.statusCode, {this.code, this.details = const {}});

  final int statusCode;

  /// Machine-readable reason, e.g. `name_taken`, `invite_closed`, `pin_locked`.
  final String? code;

  /// The rest of the error body, e.g. `attemptsLeft`, `retryAfterSeconds`.
  final Map<String, dynamic> details;

  @override
  String toString() => 'ApiException($statusCode, $code)';
}

/// Raised when the device cannot reach the server at all.
class NetworkException implements Exception {
  NetworkException(this.cause);

  final Object cause;

  @override
  String toString() => 'NetworkException($cause)';
}
