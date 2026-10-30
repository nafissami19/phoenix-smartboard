import { spawn } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { platform } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const androidDir = join(root, 'android');
const releaseDir = join(root, 'release');
const isWin = platform() === 'win32';
const gradlewCmd = isWin ? 'gradlew.bat' : './gradlew';

console.log('Building Android release APK with Gradle...');

const env = { ...process.env };
if (!env.JAVA_HOME && process.env.LOCALAPPDATA) {
  const tempJdk = join(process.env.LOCALAPPDATA, 'Temp', 'jdk21');
  env.JAVA_HOME = tempJdk;
  env.PATH = `${join(tempJdk, 'bin')};${env.PATH}`;
}
if (!env.ANDROID_HOME && process.env.LOCALAPPDATA) {
  env.ANDROID_HOME = join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
}

const child = spawn(join(androidDir, gradlewCmd), ['assembleRelease'], {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: true
});

child.on('close', async (code) => {
  if (code !== 0) {
    console.error(`Gradle build failed with exit code ${code}`);
    process.exit(code ?? 1);
  }

  await mkdir(releaseDir, { recursive: true });
  const unsignedApk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
  const targetApk = join(releaseDir, 'phoenix-smartboard-1.0.0-release.apk');

  try {
    await copyFile(unsignedApk, targetApk);
    console.log(`Copied release APK to: ${targetApk}`);
  } catch (err) {
    console.warn(`Warning copying release apk: ${err.message}`);
  }

  process.exit(0);
});
