import 'dart:typed_data';

enum PhotoType { jpeg, png, webp, heic, unknown }

const _heicBrands = {'heic', 'heix', 'hevc', 'mif1', 'msf1', 'heif'};

String _ascii(Uint8List bytes, int start, int end) =>
    String.fromCharCodes(bytes.sublist(start, end));

/// Detects the type from magic bytes, mirroring the server so a doomed upload is refused before it starts.
PhotoType sniffPhotoType(Uint8List bytes) {
  if (bytes.length >= 3 &&
      bytes[0] == 0xff &&
      bytes[1] == 0xd8 &&
      bytes[2] == 0xff) {
    return PhotoType.jpeg;
  }
  if (bytes.length >= 4 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4e &&
      bytes[3] == 0x47) {
    return PhotoType.png;
  }
  if (bytes.length >= 12 &&
      _ascii(bytes, 0, 4) == 'RIFF' &&
      _ascii(bytes, 8, 12) == 'WEBP') {
    return PhotoType.webp;
  }
  if (bytes.length >= 12 &&
      _ascii(bytes, 4, 8) == 'ftyp' &&
      _heicBrands.contains(_ascii(bytes, 8, 12))) {
    return PhotoType.heic;
  }
  return PhotoType.unknown;
}

/// The content type to declare; the server trusts the bytes, not this header.
String contentTypeOf(PhotoType type) => switch (type) {
  PhotoType.jpeg => 'image/jpeg',
  PhotoType.png => 'image/png',
  PhotoType.webp => 'image/webp',
  PhotoType.heic => 'image/heic',
  PhotoType.unknown => 'application/octet-stream',
};
