/// The server's time as best the device can tell: the device clock plus the offset seen at the last sync.
class ServerClock {
  const ServerClock.device() : _offset = Duration.zero;

  const ServerClock._(this._offset);

  /// Remembers how far the device clock is from [serverTime] at this moment.
  factory ServerClock.sync({
    required DateTime serverTime,
    DateTime? deviceNow,
  }) => ServerClock._(serverTime.difference(deviceNow ?? DateTime.now()));

  final Duration _offset;

  /// Keeps running with the device clock; it does not stand still at the moment of the sync.
  DateTime now({DateTime? deviceNow}) =>
      (deviceNow ?? DateTime.now()).add(_offset);
}
