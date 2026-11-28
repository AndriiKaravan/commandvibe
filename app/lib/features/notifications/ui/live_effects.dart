/// A short message shown at the bottom while the app is open.
enum LiveToast { dayOpened, myTurn, comment }

/// What a realtime event means for this person: maybe a toast, maybe a dot on a tab.
class LiveEffect {
  const LiveEffect({this.toast, this.dotTab});

  final LiveToast? toast;
  final int? dotTab;
}

/// Tab positions in the group shell.
const todayTab = 0;
const feedTab = 2;

/// Null for events that are not news for [selfMemberId]; nothing is said about one's own actions.
LiveEffect? liveEffectOf(
  String type,
  Map<String, dynamic> data, {
  required String? selfMemberId,
}) {
  switch (type) {
    case 'day.opened':
      return const LiveEffect(toast: LiveToast.dayOpened, dotTab: todayTab);
    case 'roulette.waiting':
      return selfMemberId != null && data['pickerMemberId'] == selfMemberId
          ? const LiveEffect(toast: LiveToast.myTurn, dotTab: todayTab)
          : null;
    case 'submission.created':
    case 'submission.replaced':
      return data['memberId'] == selfMemberId
          ? null
          : const LiveEffect(dotTab: feedTab);
    case 'photos.revealed':
      return const LiveEffect(dotTab: feedTab);
    case 'comment.created':
      final mine = selfMemberId != null && data['memberId'] == selfMemberId;
      return mine && data['by'] != selfMemberId
          ? const LiveEffect(toast: LiveToast.comment, dotTab: feedTab)
          : null;
    default:
      return null;
  }
}
