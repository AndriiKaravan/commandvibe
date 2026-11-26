// generated from ks_server/realtime — do not edit; run: npm run sync:realtime
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Lives next to the copied files in the backend. Fails when any copy no
// longer matches what scripts/sync.mjs wrote, so a hand edit or a formatter
// pass cannot drift away from ks_server unnoticed.
const dir = __dirname;
const manifest = JSON.parse(
  readFileSync(path.join(dir, 'realtime.manifest.json'), 'utf8'),
) as { files: Record<string, string> };

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

describe('realtime copy', () => {
  it('should match the manifest written by sync:realtime', () => {
    for (const [name, recorded] of Object.entries(manifest.files)) {
      const actual = sha256(readFileSync(path.join(dir, name), 'utf8'));
      if (actual !== recorded) {
        throw new Error(
          `${name} differs from the ks_server copy (hand edit, or prettier/eslint ` +
            'ran on this folder — add it to .prettierignore and eslint ignores); ' +
            'run npm run sync:realtime',
        );
      }
    }
  });

  it('should list every .ts file in the manifest', () => {
    const present = readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .sort();
    expect(present).toEqual(Object.keys(manifest.files).sort());
  });
});
