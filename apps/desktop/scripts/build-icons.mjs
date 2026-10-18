import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandingDirectory = path.join(appRoot, 'branding');
const publicDirectory = path.join(appRoot, 'public');
const buildDirectory = path.join(appRoot, 'build');
const detailedSource = path.join(brandingDirectory, 'app-icon.svg');
const simplifiedSource = path.join(brandingDirectory, 'app-icon-small.svg');

await fs.mkdir(publicDirectory, { recursive: true });
await fs.mkdir(buildDirectory, { recursive: true });

async function renderPng(sourcePath, size, targetPath) {
  const image = await loadImage(await fs.readFile(sourcePath));
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, size, size);
  await fs.writeFile(targetPath, await canvas.encode('png'));
}

await renderPng(detailedSource, 1024, path.join(publicDirectory, 'app-icon.png'));
await renderPng(simplifiedSource, 32, path.join(publicDirectory, 'app-icon-32.png'));
await renderPng(simplifiedSource, 16, path.join(publicDirectory, 'app-icon-16.png'));
await fs.copyFile(simplifiedSource, path.join(publicDirectory, 'app-icon.svg'));

if (process.platform === 'darwin') {
  const icnsVariants = [
    ['icp4', 16, simplifiedSource],
    ['icp5', 32, simplifiedSource],
    ['icp6', 64, detailedSource],
    ['ic07', 128, detailedSource],
    ['ic08', 256, detailedSource],
    ['ic09', 512, detailedSource],
    ['ic10', 1024, detailedSource],
    ['ic11', 32, simplifiedSource],
    ['ic12', 64, detailedSource],
    ['ic13', 256, detailedSource],
    ['ic14', 512, detailedSource],
  ];
  const entries = await Promise.all(icnsVariants.map(async ([type, size, sourcePath]) => {
    const image = await loadImage(await fs.readFile(sourcePath));
    const canvas = createCanvas(size, size);
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, size, size);
    const png = await canvas.encode('png');
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  }));
  const totalLength = 8 + entries.reduce((sum, entry) => sum + entry.length, 0);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(totalLength, 4);
  await fs.writeFile(path.join(buildDirectory, 'AppIcon.icns'), Buffer.concat([header, ...entries]));
}

console.log('L2DEditor application icons generated.');
