import * as exifr from 'exifr';
import sharp from 'sharp';
import { ExifTime } from './exif-time';
import { PhotoRejected, sniffImageType } from './image-type';

export interface ProcessedPhoto {
  photo: Buffer;
  blur: Buffer;
  width: number;
  height: number;
  exifTime?: ExifTime;
}

const maxSide = 1600;
const blurSeedSide = 32;
const blurSide = 320;
const maxPixels = 60_000_000;

sharp.cache(false);

async function readExifTime(bytes: Buffer): Promise<ExifTime | undefined> {
  try {
    const tags = await exifr.parse(bytes, {
      pick: ['DateTimeOriginal', 'OffsetTimeOriginal', 'CreateDate'],
      reviveValues: false,
    });
    const raw: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
    if (typeof raw !== 'string') {
      return undefined;
    }
    const wall = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    const offset: unknown = tags?.OffsetTimeOriginal;
    return typeof offset === 'string' ? { wall, offset } : { wall };
  } catch {
    // Unreadable EXIF only means "no time"; the photo itself may still be fine.
    return undefined;
  }
}

/** Re-encodes to a metadata-free JPEG and derives a blur that cannot be sharpened back. */
export async function processPhoto(bytes: Buffer): Promise<ProcessedPhoto> {
  const type = sniffImageType(bytes);
  if (type === 'heic') {
    throw new PhotoRejected('heic_unsupported');
  }
  if (type === 'unknown') {
    throw new PhotoRejected('unsupported_type');
  }
  const exifTime = await readExifTime(bytes);
  try {
    const input = () => sharp(bytes, { limitInputPixels: maxPixels, failOn: 'error', pages: 1 });
    const photo = await input()
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .toColourspace('srgb')
      .jpeg({ quality: 82 })
      .toBuffer();
    const meta = await sharp(photo).metadata();
    const blur = await sharp(photo)
      .resize({ width: blurSeedSide, height: blurSeedSide, fit: 'inside' })
      .blur(1.2)
      .resize({ width: blurSide, height: blurSide, fit: 'inside', kernel: 'cubic' })
      .blur(6)
      .jpeg({ quality: 60 })
      .toBuffer();
    return { photo, blur, width: meta.width ?? 0, height: meta.height ?? 0, exifTime };
  } catch {
    throw new PhotoRejected('invalid_image');
  }
}
