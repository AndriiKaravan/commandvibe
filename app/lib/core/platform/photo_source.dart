import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';

enum PhotoOrigin { camera, gallery }

/// A photo as picked, untouched: the server reads EXIF, resizes and strips metadata.
@immutable
class PickedPhoto {
  const PickedPhoto({
    required this.bytes,
    required this.name,
    required this.origin,
  });

  final Uint8List bytes;
  final String name;
  final PhotoOrigin origin;
}

/// Camera or gallery on every platform; on the web image_picker adds `capture` to the file input.
abstract interface class PhotoSource {
  factory PhotoSource.platform() => ImagePickerPhotoSource();

  /// Null when the person cancelled.
  Future<PickedPhoto?> pick(PhotoOrigin origin);
}

class ImagePickerPhotoSource implements PhotoSource {
  ImagePickerPhotoSource([ImagePicker? picker])
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<PickedPhoto?> pick(PhotoOrigin origin) async {
    // No maxWidth: resizing in the browser re-encodes through canvas and drops EXIF.
    final file = await _picker.pickImage(
      source: origin == PhotoOrigin.camera
          ? ImageSource.camera
          : ImageSource.gallery,
    );
    if (file == null) {
      return null;
    }
    return PickedPhoto(
      bytes: await file.readAsBytes(),
      name: file.name,
      origin: origin,
    );
  }
}
