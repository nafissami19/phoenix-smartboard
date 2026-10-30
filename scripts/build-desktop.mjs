import { spawn } from 'node:child_process';
import { copyFile, cp, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const releaseDir = join(root, 'release');
const tempOutDir = join(tmpdir(), 'phoenix-release');

console.log('Building Windows Desktop executable with electron-builder...');

const builderCmd = process.platform === 'win32'
  ? join(root, 'node_modules', '.bin', 'electron-builder.cmd')
  : join(root, 'node_modules', '.bin', 'electron-builder');
const args = ['--win', 'nsis', '--publish', 'never', `-c.directories.output=${tempOutDir}`];

const child = spawn(builderCmd, args, {
  cwd: root,
  stdio: 'inherit',
  shell: true
});

child.on('close', async (code) => {
  if (code !== 0) {
    console.error(`electron-builder failed with exit code ${code}`);
    process.exit(code ?? 1);
  }

  await mkdir(releaseDir, { recursive: true });
  const exeName = 'Phoenix Smartboard Setup 1.0.0.exe';
  const srcExe = join(tempOutDir, exeName);
  const destExe = join(releaseDir, exeName);

  try {
    await copyFile(srcExe, destExe);
    console.log(`Copied installer to: ${destExe}`);
  } catch (err) {
    console.warn(`Warning copying installer: ${err.message}`);
  }

  try {
    const srcBlockmap = join(tempOutDir, `${exeName}.blockmap`);
    await copyFile(srcBlockmap, join(releaseDir, `${exeName}.blockmap`));
  } catch {}

  try {
    const srcUnpacked = join(tempOutDir, 'win-unpacked');
    await cp(srcUnpacked, join(releaseDir, 'win-unpacked'), { recursive: true, force: true });
    console.log(`Copied portable unpacked binaries to: ${join(releaseDir, 'win-unpacked')}`);
  } catch (err) {
    console.warn(`Warning copying unpacked binaries: ${err.message}`);
  }

  process.exit(0);
});
