import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = path.join(root, '.tmp');
await mkdir(temp, { recursive: true });
// Keep Windows tools usable when the system drive is full; portable on other OSes.
const env = {
  ...process.env,
  TEMP: temp,
  TMP: temp,
  TMPDIR: temp,
  NODE_COMPILE_CACHE: path.join(root, '.cache', 'node'),
};
const mode = process.argv[2];
const extra = process.argv.slice(3);
const commands = {
  dev: [['vite/bin/vite.js', '--host', '127.0.0.1', ...extra]],
  build: [
    ['typescript/bin/tsc', '-b'],
    ['vite/bin/vite.js', 'build', ...extra],
  ],
  lint: [['eslint/bin/eslint.js', '.', '--max-warnings', '0', ...extra]],
  test: [['vitest/vitest.mjs', 'run', ...extra]],
  watch: [['vitest/vitest.mjs', ...extra]],
  e2e: [['@playwright/test/cli.js', 'test', ...extra]],
  preview: [['vite/bin/vite.js', 'preview', '--host', '127.0.0.1', ...extra]],
  format: [
    [
      'prettier/bin/prettier.cjs',
      '--write',
      'src',
      'tests',
      'scripts',
      'docs',
      '*.json',
      '*.ts',
      '*.js',
      ...extra,
    ],
  ],
};
if (!commands[mode]) throw Error(`Unknown command: ${mode}`);
for (const [entry, ...args] of commands[mode]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'node_modules', entry), ...args], {
      cwd: root,
      env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
  if (code !== 0) {
    process.exitCode = Number(code);
    break;
  }
}
