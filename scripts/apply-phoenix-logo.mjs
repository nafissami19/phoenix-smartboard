import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcePngPath = 'C:/Users/sami6/.gemini/antigravity/brain/5552db00-ebc9-48ad-8429-1d35f6bbec54/.user_uploaded/media_1792432699537_8379fedc.png';

const logoBuffer = await readFile(sourcePngPath);
const logoBase64 = logoBuffer.toString('base64');

// 1. Copy full logo PNG
await writeFile(path.join(root, 'public/logo.png'), logoBuffer);
await writeFile(path.join(root, 'branding/logo.png'), logoBuffer);

// 2. Generate public/logo.svg and branding/logo.svg
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 363" width="1024" height="363">
  <title>Phoenix Education</title>
  <image href="data:image/png;base64,${logoBase64}" width="1024" height="363"/>
</svg>
`;
await writeFile(path.join(root, 'public/logo.svg'), logoSvg, 'utf8');
await writeFile(path.join(root, 'branding/logo.svg'), logoSvg, 'utf8');

// 3. Launch browser to crop the bird and generate square icons
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<img id="srcImg" src="data:image/png;base64,${logoBase64}" />`);

  // Extract bird and generate square icon at given size
  const renderSquareIcon = async (size, paddingRatio = 0.12) => {
    const data = await page.evaluate(async ({ size, paddingRatio }) => {
      const img = document.getElementById('srcImg');
      await img.decode();

      // Bird bounds in source:
      // x: 0 to 330, y: 0 to 362
      const bx = 0, by = 0, bw = 331, bh = 363;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const maxDim = size * (1 - paddingRatio * 2);
      const scale = Math.min(maxDim / bw, maxDim / bh);
      const drawW = bw * scale;
      const drawH = bh * scale;
      const drawX = (size - drawW) / 2;
      const drawY = (size - drawH) / 2;

      ctx.drawImage(img, bx, by, bw, bh, drawX, drawY, drawW, drawH);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { size, paddingRatio });
    return Buffer.from(data, 'base64');
  };

  // Generate 512x512 icon
  const icon512 = await renderSquareIcon(512, 0.12);
  await writeFile(path.join(root, 'public/icon-512.png'), icon512);

  // Generate 192x192 icon
  const icon192 = await renderSquareIcon(192, 0.12);
  await writeFile(path.join(root, 'public/icon-192.png'), icon192);

  // Generate maskable icon (padded to fit inside the safe circular area, ~22% padding)
  const iconMaskable512 = await renderSquareIcon(512, 0.22);
  await writeFile(path.join(root, 'public/icon-maskable-512.png'), iconMaskable512);

  // Generate public/icon.svg embedding the high-res 512x512 bird emblem
  const icon512Base64 = icon512.toString('base64');
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>Phoenix Emblem</title>
  <image href="data:image/png;base64,${icon512Base64}" width="512" height="512"/>
</svg>
`;
  await writeFile(path.join(root, 'public/icon.svg'), iconSvg, 'utf8');

  // Android mipmap densities
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(densities)) {
    const folder = path.join(root, 'branding/android', `mipmap-${density}`);
    await mkdir(folder, { recursive: true });
    const png = await renderSquareIcon(size, 0.1);
    await writeFile(path.join(folder, 'ic_launcher.png'), png);
    await writeFile(path.join(folder, 'ic_launcher_round.png'), png);
  }

  // Windows multi-resolution ICO file
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const frames = await Promise.all(sizes.map(size => renderSquareIcon(size, 0.08)));
  const directory = Buffer.alloc(6 + 16 * sizes.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  for (let i = 0; i < sizes.length; i++) {
    const entry = 6 + i * 16;
    directory[entry] = sizes[i] === 256 ? 0 : sizes[i];
    directory[entry + 1] = directory[entry];
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(frames[i].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frames[i].length;
  }
  await writeFile(path.join(root, 'branding/icon.ico'), Buffer.concat([directory, ...frames]));

  // Social card (1200x630)
  const socialCardData = await page.evaluate(async () => {
    const img = document.getElementById('srcImg');
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');

    // Dark sleek background
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#0b1120');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // Subtle blue radial glow behind logo
    const glow = ctx.createRadialGradient(600, 280, 50, 600, 280, 450);
    glow.addColorStop(0, 'rgba(0, 102, 255, 0.28)');
    glow.addColorStop(0.5, 'rgba(0, 158, 255, 0.08)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1200, 630);

    // Draw full Phoenix logo centered
    const targetW = 680;
    const targetH = targetW * (img.naturalHeight / img.naturalWidth);
    const targetX = (1200 - targetW) / 2;
    const targetY = 200;
    ctx.drawImage(img, targetX, targetY, targetW, targetH);

    // Subtitle tagline
    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('Interactive Teaching Whiteboard & STEM Suite', 600, 480);

    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile(path.join(root, 'public/social-card.png'), Buffer.from(socialCardData, 'base64'));

  // Logo preview
  const logoPreviewData = await page.evaluate(async () => {
    const img = document.getElementById('srcImg');
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 208;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 840, 208);

    const targetH = 150;
    const targetW = targetH * (img.naturalWidth / img.naturalHeight);
    const targetX = (840 - targetW) / 2;
    const targetY = (208 - targetH) / 2;
    ctx.drawImage(img, targetX, targetY, targetW, targetH);

    return canvas.toDataURL('image/png').split(',')[1];
  });
  await writeFile(path.join(root, 'branding/logo-preview.png'), Buffer.from(logoPreviewData, 'base64'));

  console.log('Successfully generated all Phoenix branding assets:');
  console.log(' - public/logo.png & branding/logo.png');
  console.log(' - public/logo.svg & branding/logo.svg');
  console.log(' - public/icon.svg (bird emblem)');
  console.log(' - public/icon-192.png & public/icon-512.png');
  console.log(' - public/icon-maskable-512.png');
  console.log(' - branding/icon.ico');
  console.log(' - branding/android/mipmap-*/ic_launcher.png');
  console.log(' - public/social-card.png');
  console.log(' - branding/logo-preview.png');
} finally {
  await browser.close();
}
