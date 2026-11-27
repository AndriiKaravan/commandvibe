export type ImageType = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown';

export type PhotoRejectCode = 'unsupported_type' | 'heic_unsupported' | 'invalid_image';

export class PhotoRejected extends Error {
  constructor(readonly code: PhotoRejectCode) {
    super(code);
  }
}

const heicBrands = new Set(['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heif']);

/** Detects the type from magic bytes; the client-declared content type is never trusted. */
export function sniffImageType(bytes: Buffer): ImageType {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (bytes.length >= 4 && bytes.readUInt32BE(0) === 0x89504e47) {
    return 'png';
  }
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('latin1', 4, 8) === 'ftyp' &&
    heicBrands.has(bytes.toString('latin1', 8, 12))
  ) {
    return 'heic';
  }
  return 'unknown';
}
