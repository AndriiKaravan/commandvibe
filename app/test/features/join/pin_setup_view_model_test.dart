import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/features/join/data/join_repository.dart';
import 'package:commandvibe/features/join/ui/pin_setup_view_model.dart';
import 'package:flutter_test/flutter_test.dart';

class RecordingJoinRepository implements JoinRepository {
  final List<String> pins = [];
  Object? error;

  @override
  Future<void> setPin(String pin) async {
    if (error != null) throw error!;
    pins.add(pin);
  }

  @override
  Future<InvitePreview> preview(String token) => throw UnimplementedError();

  @override
  Future<JoinedMember> join(String token, String displayName) =>
      throw UnimplementedError();

  @override
  Future<JoinedMember> returning(
    String token,
    String displayName,
    String pin,
  ) => throw UnimplementedError();
}

void main() {
  group('PinSetupViewModel', () {
    late RecordingJoinRepository repository;
    late PinSetupViewModel viewModel;

    setUp(() {
      repository = RecordingJoinRepository();
      viewModel = PinSetupViewModel(repository);
    });

    test('should save a 4-digit PIN', () async {
      await viewModel.save('0427');
      expect(repository.pins, ['0427']);
      expect(viewModel.status, PinSetupStatus.saved);
    });

    test(
      'should reject anything but 4 digits without calling the server',
      () async {
        for (final pin in ['123', '12345', '12a4', '']) {
          await viewModel.save(pin);
          expect(viewModel.status, PinSetupStatus.invalid);
        }
        expect(repository.pins, isEmpty);
      },
    );

    test('should report a server failure', () async {
      repository.error = ApiException(500);
      await viewModel.save('1234');
      expect(viewModel.status, PinSetupStatus.failed);
    });
  });
}
