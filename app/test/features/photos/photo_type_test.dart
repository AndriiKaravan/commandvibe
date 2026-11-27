import 'dart:typed_data';

import 'package:commandvibe/features/photos/data/photo_type.dart';
import 'package:flutter_test/flutter_test.dart';

Uint8List _bytes(List<int> head, [int pad = 16]) =>
    Uint8List.fromList([...head, ...List.filled(pad, 0)]);

void main() {
  group('sniffPhotoType', () {
    test('should recognise jpeg, png and webp by magic bytes', () {
      expect(sniffPhotoType(_bytes([0xff, 0xd8, 0xff, 0xe0])), PhotoType.jpeg);
      expect(sniffPhotoType(_bytes([0x89, 0x50, 0x4e, 0x47])), PhotoType.png);
      final webp = Uint8List.fromList([
        ...'RIFF'.codeUnits,
        0,
        0,
        0,
        0,
        ...'WEBP'.codeUnits,
      ]);
      expect(sniffPhotoType(webp), PhotoType.webp);
    });

    test('should recognise every heic brand', () {
      for (final brand in ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heif']) {
        final bytes = Uint8List.fromList([
          0,
          0,
          0,
          24,
          ...'ftyp'.codeUnits,
          ...brand.codeUnits,
          0,
          0,
          0,
          0,
        ]);
        expect(sniffPhotoType(bytes), PhotoType.heic, reason: brand);
      }
    });

    test('should call everything else unknown, including a short file', () {
      expect(
        sniffPhotoType(Uint8List.fromList('hello'.codeUnits)),
        PhotoType.unknown,
      );
      expect(sniffPhotoType(Uint8List(0)), PhotoType.unknown);
      expect(
        sniffPhotoType(Uint8List.fromList([0xff, 0xd8])),
        PhotoType.unknown,
      );
    });
  });
}
