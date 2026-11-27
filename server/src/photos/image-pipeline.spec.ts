import sharp from 'sharp';
import { processPhoto } from './image-pipeline';
import { PhotoRejected } from './image-type';
import { checkerboard, halvesJpeg, heicHeader, jpeg, padTo, png } from './testing/fixture-images';

describe('processPhoto', () => {
  it('should strip every metadata block, including GPS and camera model', async () => {
    const source = await jpeg({
      width: 4000,
      height: 3000,
      gps: true,
      make: 'SecretCam',
      dateTimeOriginal: '2026:12:01 08:59:00',
    });
    const result = await processPhoto(source);
    expect({ w: result.width, h: result.height }).toEqual({ w: 1600, h: 1200 });
    for (const buffer of [result.photo, result.blur]) {
      const meta = await sharp(buffer).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(buffer.includes(Buffer.from('SecretCam'))).toBe(false);
      expect(buffer.includes(Buffer.from('GPS'))).toBe(false);
      expect(buffer.includes(Buffer.from('SN-SECRET'))).toBe(false);
    }
    expect(result.exifTime).toEqual({ wall: '2026-12-01 08:59:00' });
  });

  it('should rotate by EXIF orientation and drop the tag', async () => {
    const result = await processPhoto(await halvesJpeg(400, 200, 6));
    const meta = await sharp(result.photo).metadata();
    expect({ w: meta.width, h: meta.height }).toEqual({ w: 200, h: 400 });
    expect(meta.orientation).toBeUndefined();
    const { data } = await sharp(result.photo).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => Array.from(data.subarray((y * 200 + x) * 3, (y * 200 + x) * 3 + 3));
    expect(at(100, 20)[0]).toBeGreaterThan(200);
    expect(at(100, 20)[2]).toBeLessThan(60);
  });

  it('should not enlarge small photos', async () => {
    const result = await processPhoto(await jpeg({ width: 800, height: 600 }));
    expect({ w: result.width, h: result.height }).toEqual({ w: 800, h: 600 });
  });

  it('should flatten transparent png onto white', async () => {
    const result = await processPhoto(await png({ alpha: true }));
    const { data } = await sharp(result.photo).raw().toBuffer({ resolveWithObject: true });
    expect(Array.from(data.subarray(0, 3)).every((v) => v > 245)).toBe(true);
  });

  it('should make a small blur that cannot show fine detail', async () => {
    const result = await processPhoto(await checkerboard(1600, 1200, 8));
    const meta = await sharp(result.blur).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(320);
    expect(result.blur.length).toBeLessThanOrEqual(8 * 1024);
    const stats = await sharp(result.blur).stats();
    for (const channel of stats.channels) {
      expect(channel.stdev).toBeLessThan(4);
    }
  });

  it('should reject heic with its own code', async () => {
    await expect(processPhoto(heicHeader())).rejects.toMatchObject({ code: 'heic_unsupported' });
  });

  it('should reject unknown bytes, truncated files and huge pixel counts', async () => {
    await expect(processPhoto(Buffer.from('hello'))).rejects.toBeInstanceOf(PhotoRejected);
    const whole = await jpeg({ width: 800, height: 600 });
    await expect(processPhoto(whole.subarray(0, 300))).rejects.toMatchObject({ code: 'invalid_image' });
    const huge = await sharp({ create: { width: 9000, height: 8000, channels: 3, background: '#000' } })
      .jpeg({ quality: 20 })
      .toBuffer();
    await expect(processPhoto(huge)).rejects.toMatchObject({ code: 'invalid_image' });
  });

  it('should ignore bytes after the end marker', async () => {
    const padded = padTo(await jpeg({ width: 800, height: 600 }), 20_971_519);
    const result = await processPhoto(padded);
    expect(result.width).toBe(800);
  });
});
