import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await cp(path.join(rootDir, 'public'), distDir, { recursive: true });
await cp(path.join(rootDir, 'data'), path.join(distDir, 'data'), { recursive: true });

console.log(`Built static site in ${path.relative(rootDir, distDir)}`);
