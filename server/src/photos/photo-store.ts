export interface PhotoStore {
  put(path: string, bytes: Buffer, contentType: string): Promise<void>;
  get(path: string): Promise<Buffer | undefined>;
  /** A missing file is not an error. */
  delete(paths: string[]): Promise<void>;
  /** Removes every file under the prefix and returns how many there were. */
  deletePrefix(prefix: string): Promise<number>;
}

export const PHOTO_STORE = Symbol('PhotoStore');

/** Storage layout; the `groups/{g}/` prefix lets one call remove a whole group (P7). */
export function photoPaths(
  groupId: string,
  dayIndex: number,
  memberId: string,
  version: string,
): { photo: string; blur: string; prefix: string } {
  const prefix = `groups/${groupId}/cells/${String(dayIndex).padStart(2, '0')}/${memberId}/`;
  return { photo: `${prefix}${version}/photo.jpg`, blur: `${prefix}${version}/blur.jpg`, prefix };
}

export class MemoryPhotoStore implements PhotoStore {
  private readonly files = new Map<string, Buffer>();

  /** Test helper: how many files are stored. */
  get size(): number {
    return this.files.size;
  }

  paths(): string[] {
    return [...this.files.keys()];
  }

  async put(path: string, bytes: Buffer): Promise<void> {
    this.files.set(path, Buffer.from(bytes));
  }

  async get(path: string): Promise<Buffer | undefined> {
    const found = this.files.get(path);
    return found && Buffer.from(found);
  }

  async delete(paths: string[]): Promise<void> {
    paths.forEach((path) => this.files.delete(path));
  }

  async deletePrefix(prefix: string): Promise<number> {
    const matching = [...this.files.keys()].filter((path) => path.startsWith(prefix));
    matching.forEach((path) => this.files.delete(path));
    return matching.length;
  }
}
