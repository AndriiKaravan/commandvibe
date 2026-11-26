// generated from ks_core/server/app_check — do not edit; run: npm run sync:app-check
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Lives next to the copied files in the backend. Fails when any copy no
// longer matches what sync-app-check wrote, so a hand edit or a formatter
// pass cannot drift away from ks_core unnoticed.
const dir = __dirname;
const manifest = JSON.parse(
  readFileSync(path.join(dir, 'app-check.manifest.json'), 'utf8'),
) as { files: Record<string, string> };

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

describe('app_check copy', () => {
  it('should match the manifest written by sync:app-check', () => {
    for (const [name, recorded] of Object.entries(manifest.files)) {
      const actual = sha256(readFileSync(path.join(dir, name), 'utf8'));
      if (actual !== recorded) {
        throw new Error(
          `${name} differs from the ks_core copy (hand edit, or prettier/eslint ` +
            'ran on this folder — add it to .prettierignore and eslint ignores); ' +
            'run npm run sync:app-check',
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
