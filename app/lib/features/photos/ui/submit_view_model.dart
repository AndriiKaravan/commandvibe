import 'dart:async';

import 'package:commandvibe/core/api/api_exception.dart';
import 'package:commandvibe/core/platform/photo_source.dart';
import 'package:commandvibe/features/photos/data/photo_type.dart';
import 'package:commandvibe/features/photos/data/photos_models.dart';
import 'package:commandvibe/features/photos/data/photos_repository.dart';
import 'package:flutter/foundation.dart';

sealed class SubmitState {
  const SubmitState();
}

class SubmitIdle extends SubmitState {
  const SubmitIdle();
}

class SubmitUploading extends SubmitState {
  const SubmitUploading();
}

/// A photo already exists for the day; the person must agree to replace it.
class SubmitConfirmReplace extends SubmitState {
  const SubmitConfirmReplace(this.version);

  final String version;
}

class SubmitDone extends SubmitState {
  const SubmitDone(this.item);

  final SubmissionItem item;
}

enum SubmitError {
  tooLarge,
  heicUnsupported,
  unsupportedType,
  invalidImage,
  dayClosed,
  revealPassed,
  photoHidden,
  network,
  failed,
}

class SubmitFailed extends SubmitState {
  const SubmitFailed(this.error);

  final SubmitError error;
}

/// Picks a photo and sends it, refusing files the server would refuse before they use any data.
class SubmitViewModel extends ChangeNotifier {
  SubmitViewModel(
    this._repository,
    this._photoSource, {
    required this.groupId,
    required this.dayIndex,
    this.retryDelay = const Duration(seconds: 3),
  });

  /// The server accepts 20 MiB; this leaves room for a slow link and keeps replies fast.
  static const maxUploadBytes = 15 * 1024 * 1024;
  static const _busyRetries = 3;

  final PhotosRepository _repository;
  final PhotoSource _photoSource;
  final String groupId;
  final int dayIndex;
  final Duration retryDelay;

  SubmitState _state = const SubmitIdle();
  PickedPhoto? _pending;
  String? _replaces;
  bool _disposed = false;

  SubmitState get state => _state;

  Future<void> pick(PhotoOrigin origin) async {
    final photo = await _photoSource.pick(origin);
    if (photo == null) {
      _set(const SubmitIdle());
      return;
    }
    final refusal = _refusalFor(photo);
    if (refusal != null) {
      _set(SubmitFailed(refusal));
      return;
    }
    _pending = photo;
    _replaces = null;
    await _send();
  }

  /// After [SubmitConfirmReplace]: the person agreed to replace the earlier photo.
  Future<void> confirmReplace() async {
    final current = _state;
    if (current is! SubmitConfirmReplace || _pending == null) {
      return;
    }
    _replaces = current.version;
    await _send();
  }

  /// Sends the same photo again after a failure, without asking for it a second time.
  Future<void> retry() async {
    if (_pending != null) {
      await _send();
    }
  }

  SubmitError? _refusalFor(PickedPhoto photo) {
    if (photo.bytes.length > maxUploadBytes) {
      return SubmitError.tooLarge;
    }
    return switch (sniffPhotoType(photo.bytes)) {
      PhotoType.heic => SubmitError.heicUnsupported,
      PhotoType.unknown => SubmitError.unsupportedType,
      _ => null,
    };
  }

  Future<void> _send() async {
    final photo = _pending!;
    _set(const SubmitUploading());
    for (var attempt = 0; ; attempt++) {
      try {
        final item = await _repository.submit(
          groupId,
          dayIndex,
          photo,
          replaces: _replaces,
        );
        _pending = null;
        _set(SubmitDone(item));
        return;
      } on ApiException catch (error) {
        if (error.statusCode == 503 && attempt < _busyRetries) {
          await Future<void>.delayed(retryDelay);
          if (_disposed) {
            return;
          }
          continue;
        }
        final version = error.details['version'];
        if (error.code == 'already_submitted' && version is String) {
          _set(SubmitConfirmReplace(version));
        } else {
          _set(SubmitFailed(_errorOf(error)));
        }
        return;
      } on NetworkException {
        _set(const SubmitFailed(SubmitError.network));
        return;
      }
    }
  }

  SubmitError _errorOf(ApiException error) => switch (error.code) {
    'photo_too_large' => SubmitError.tooLarge,
    'heic_unsupported' => SubmitError.heicUnsupported,
    'unsupported_type' => SubmitError.unsupportedType,
    'invalid_image' => SubmitError.invalidImage,
    'day_not_open' || 'game_finished' || 'not_playing' => SubmitError.dayClosed,
    'reveal_passed' => SubmitError.revealPassed,
    'photo_hidden' => SubmitError.photoHidden,
    _ => SubmitError.failed,
  };

  void _set(SubmitState next) {
    if (_disposed) {
      return;
    }
    _state = next;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
