import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve('@mediapipe/face_mesh'));
const { version } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const destination = new URL(`../public/vendor/mediapipe/face_mesh/${version}/`, import.meta.url);
mkdirSync(destination, { recursive: true });
for (const file of readdirSync(packageDir)) {
  if (/\.(js|wasm|data|binarypb)$/.test(file)) {
    copyFileSync(join(packageDir, file), new URL(file, destination));
  }
}
console.log(`Prepared local MediaPipe FaceMesh ${version} assets.`);
