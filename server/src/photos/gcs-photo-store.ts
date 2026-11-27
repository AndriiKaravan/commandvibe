import type { Bucket } from '@google-cloud/storage';
import { PhotoStore } from './photo-store';

export class GcsPhotoStore implements PhotoStore {
  constructor(private readonly bucket: Bucket) {}

  async put(path: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.bucket.file(path).save(bytes, {
      resumable: false,
      contentType,
      metadata: { cacheControl: 'no-store' },
    });
  }

  async get(path: string): Promise<Buffer | undefined> {
    const file = this.bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) {
      return undefined;
    }
    try {
      const [bytes] = await file.download();
      return bytes;
    } catch (error) {
      if ((error as { code?: number }).code === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async delete(paths: string[]): Promise<void> {
    await Promise.all(paths.map((path) => this.bucket.file(path).delete({ ignoreNotFound: true })));
  }

  async deletePrefix(prefix: string): Promise<number> {
    const [files] = await this.bucket.getFiles({ prefix });
    await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
    return files.length;
  }
}
