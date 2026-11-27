import sharp from 'sharp';
import { sniffImageType } from './image-type';
import { heicHeader, jpeg, png } from './testing/fixture-images';

describe('sniffImageType', () => {
  it('should recognise jpeg, png and webp by magic bytes', async () => {
    expect(sniffImageType(await jpeg({ width: 10, height: 10 }))).toBe('jpeg');
    expect(sniffImageType(await png({ alpha: false }))).toBe('png');
    const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
      .webp()
      .toBuffer();
    expect(sniffImageType(webp)).toBe('webp');
  });

  it('should recognise heic brands', () => {
    expect(sniffImageType(heicHeader())).toBe('heic');
    for (const brand of ['heix', 'hevc', 'mif1', 'msf1', 'heif']) {
      const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from(`ftyp${brand}`), Buffer.alloc(16)]);
      expect(sniffImageType(bytes)).toBe('heic');
    }
  });

  it('should treat anything else as unknown', () => {
    expect(sniffImageType(Buffer.from('hello'))).toBe('unknown');
    expect(sniffImageType(Buffer.alloc(0))).toBe('unknown');
  });
});
