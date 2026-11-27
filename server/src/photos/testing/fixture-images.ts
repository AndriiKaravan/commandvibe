import sharp from 'sharp';

interface JpegOptions {
  width: number;
  height: number;
  orientation?: number;
  dateTimeOriginal?: string;
  offset?: string;
  gps?: true;
  make?: string;
  color?: { r: number; g: number; b: number };
}

/** Builds a JPEG with optional EXIF so tests never need binary files in the repo. */
export async function jpeg(options: JpegOptions): Promise<Buffer> {
  const exif: Record<string, Record<string, string>> = {};
  if (options.make) {
    exif.IFD0 = { Make: options.make, SerialNumber: 'SN-SECRET-123' };
  }
  const ifd2: Record<string, string> = {};
  if (options.dateTimeOriginal) {
    ifd2.DateTimeOriginal = options.dateTimeOriginal;
  }
  if (options.offset) {
    ifd2.OffsetTimeOriginal = options.offset;
  }
  if (Object.keys(ifd2).length > 0) {
    exif.IFD2 = ifd2;
  }
  if (options.gps) {
    exif.IFD3 = {
      GPSLatitudeRef: 'N',
      GPSLatitude: '50/1 27/1 0/1',
      GPSLongitudeRef: 'E',
      GPSLongitude: '30/1 31/1 0/1',
    };
  }
  let pipeline = sharp({
    create: {
      width: options.width,
      height: options.height,
      channels: 3,
      background: options.color ?? { r: 90, g: 120, b: 200 },
    },
  });
  if (Object.keys(exif).length > 0) {
    pipeline = pipeline.withExif(exif);
  }
  if (options.orientation) {
    pipeline = pipeline.withMetadata({ orientation: options.orientation });
  }
  return pipeline.jpeg({ quality: 90 }).toBuffer();
}

/** Left half red, right half blue; handy for checking rotation. */
export async function halvesJpeg(width: number, height: number, orientation?: number): Promise<Buffer> {
  const half = await sharp({
    create: { width: width / 2, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 255 } } }).composite([
    { input: half, left: 0, top: 0 },
  ]);
  if (orientation) {
    pipeline = pipeline.withMetadata({ orientation });
  }
  return pipeline.jpeg({ quality: 95 }).toBuffer();
}

export async function png(options: { alpha: boolean }): Promise<Buffer> {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: options.alpha ? 4 : 3,
      background: options.alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 10, g: 10, b: 10 },
    },
  })
    .png()
    .toBuffer();
}

export async function checkerboard(width: number, height: number, cell: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? 255 : 0;
      const i = (y * width + x) * 3;
      raw[i] = raw[i + 1] = raw[i + 2] = on;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

export function heicHeader(): Buffer {
  return Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(32)]);
}

/** Appends zero bytes after the JPEG end marker; decoders ignore them. */
export function padTo(buffer: Buffer, bytes: number): Buffer {
  return Buffer.concat([buffer, Buffer.alloc(Math.max(0, bytes - buffer.length))]);
}
