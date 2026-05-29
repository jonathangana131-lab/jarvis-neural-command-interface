// Generates build/icon.icns for macOS packaging using only macOS-native tools
// (sips + iconutil), preferring a crisp vector rasterization via rsvg-convert
// when it is available (the release CI installs librsvg for this). Safe no-op
// on non-macOS hosts so Windows/Linux builds are unaffected.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(projectDir, 'build');
const svgPath = path.join(buildDir, 'icon.svg');
const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');
const icnsPath = path.join(buildDir, 'icon.icns');
const iconsetDir = path.join(buildDir, 'icon.iconset');
const masterPng = path.join(buildDir, 'icon-1024.png');

if (process.platform !== 'darwin') {
  console.log('[prepare-mac-icon] Not macOS; skipping icns generation.');
  process.exit(0);
}

function has(cmd) {
  return spawnSync('which', [cmd], { stdio: 'ignore' }).status === 0;
}

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

// Pull the largest embedded PNG out of a .ico so we always have a PNG source
// derived from the committed brand assets (no binary PNG is checked in).
function extractPngFromIco(srcIco, outPng) {
  const buf = fs.readFileSync(srcIco);
  const count = buf.readUInt16LE(4);
  let best = null;
  let offset = 6;
  for (let i = 0; i < count; i += 1) {
    const width = buf[offset] || 256;
    const size = buf.readUInt32LE(offset + 8);
    const dataOffset = buf.readUInt32LE(offset + 12);
    const isPng = buf.slice(dataOffset, dataOffset + 4).toString('hex') === '89504e47';
    if (isPng && (!best || width > best.width)) {
      best = { width, size, dataOffset };
    }
    offset += 16;
  }
  if (!best) {
    throw new Error('icon.ico has no embedded PNG to extract.');
  }
  fs.writeFileSync(outPng, buf.slice(best.dataOffset, best.dataOffset + best.size));
}

try {
  // 1) Produce a 1024x1024 master PNG, crisp from the SVG when possible.
  if (has('rsvg-convert') && fs.existsSync(svgPath)) {
    console.log('[prepare-mac-icon] Rasterizing icon.svg at 1024px via rsvg-convert.');
    run('rsvg-convert', ['-w', '1024', '-h', '1024', '-a', svgPath, '-o', masterPng]);
  } else {
    let pngSource = fs.existsSync(pngPath) ? pngPath : '';
    if (!pngSource && fs.existsSync(icoPath)) {
      console.log('[prepare-mac-icon] Deriving icon.png from icon.ico.');
      extractPngFromIco(icoPath, pngPath);
      pngSource = fs.existsSync(pngPath) ? pngPath : '';
    }
    if (!pngSource) {
      throw new Error('No icon source found (expected build/icon.svg, build/icon.png, or build/icon.ico).');
    }
    console.log('[prepare-mac-icon] rsvg-convert unavailable; upscaling PNG to 1024px via sips.');
    fs.copyFileSync(pngSource, masterPng);
    run('sips', ['-z', '1024', '1024', masterPng]);
  }

  // 2) Build the iconset at the resolutions macOS expects.
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });
  const variants = [
    [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png']
  ];
  for (const [size, name] of variants) {
    const out = path.join(iconsetDir, name);
    fs.copyFileSync(masterPng, out);
    run('sips', ['-z', String(size), String(size), out]);
  }

  // 3) Convert the iconset to a single .icns electron-builder will consume.
  run('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);
  console.log(`[prepare-mac-icon] Wrote ${path.relative(projectDir, icnsPath)}`);

  // 4) Leave a >=512px PNG in place for the tray and any PNG-preferring tooling.
  fs.copyFileSync(masterPng, pngPath);
} catch (error) {
  console.error(`[prepare-mac-icon] Failed to build icns: ${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.rmSync(masterPng, { force: true });
}
