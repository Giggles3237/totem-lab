import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = join(root, 'dist');

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const item of ['index.html', 'styles.css', 'src', 'assets']) {
  await cp(join(root, item), join(destination, item), { recursive: true });
}
await writeFile(join(destination, '.nojekyll'), '');
console.log(`GitHub Pages build created at ${destination}`);
