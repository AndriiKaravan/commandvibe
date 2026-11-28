import 'package:flutter/foundation.dart';
import 'package:ks_core/ks_core.dart';
import 'package:ks_core/testing.dart';

/// A subscription the test can deny, which ks_core's fake does not expose.
class DeniableSubscription implements RealtimeSubscription {
  DeniableSubscription(this.topic);

  @override
  final String topic;
  final _status = ValueNotifier(RealtimeSubscriptionStatus.active);
  String? _reason;

  void deny(String reason) {
    _reason = reason;
    _status.value = RealtimeSubscriptionStatus.denied;
  }

  @override
  Stream<RealtimeEvent> get events => const Stream.empty();

  @override
  Stream<void> get resyncs => const Stream.empty();

  @override
  ValueListenable<RealtimeSubscriptionStatus> get status => _status;

  @override
  String? get deniedReason => _reason;

  @override
  void cancel() {}
}

class DeniableRealtime extends FakeRealtimeClient {
  final subscriptions = <String, DeniableSubscription>{};

  @override
  RealtimeSubscription subscribe(String topic) =>
      subscriptions[topic] = DeniableSubscription(topic);
}
