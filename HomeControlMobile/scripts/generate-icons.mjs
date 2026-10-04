// Generates every launcher icon from one SVG design (same brand mark as the web favicon /
// LogoMark: gradient squircle, house outline, three glowing LEDs, and a light-strip underline).
//
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/generate-icons.mjs            (PLAYWRIGHT_PATH=<path to playwright/index.mjs> if installed elsewhere)
//
// Writes: Android legacy/round/adaptive (foreground, background, monochrome) mipmaps, the iOS
// AppIcon set (+ Contents.json) and the reference PNGs in assets/. Re-run after changing the design.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');
const ios = join(root, 'ios/HomeControlMobile/Images.xcassets/AppIcon.appiconset');

// ---------------------------------------------------------------------------------------------
// Design (1024 x 1024 canvas)
// ---------------------------------------------------------------------------------------------
const GRAD = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/>
  </linearGradient>
  <radialGradient id="hi" cx=".28" cy=".18" r=".75">
    <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="shade" cx=".5" cy="1.05" r=".8">
    <stop offset="0" stop-color="#1e1b4b" stop-opacity=".45"/><stop offset="1" stop-color="#1e1b4b" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="halo" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="strip" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".95"/>
    <stop offset=".75" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#1e1b4b" flood-opacity=".35"/></filter>`;

const BACKGROUND = `<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#hi)"/><rect width="1024" height="1024" fill="url(#shade)"/>`;

// The mark itself, in a 1024 box with its visual centre near (512, 512).
const mark = (mono = false) => {
  const ink = '#fff';
  const dots = [
    { x: 392, o: 1 },
    { x: 512, o: 0.78 },
    { x: 632, o: 0.52 },
  ];
  return `
  ${mono ? '' : `<circle cx="512" cy="560" r="330" fill="url(#halo)" opacity=".5"/>`}
  <g ${mono ? '' : 'filter="url(#soft)"'}>
    <g fill="none" stroke="${ink}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round">
      <path d="M200 500 512 236l312 264"/>
      <path d="M292 452v292h440V452"/>
    </g>
  </g>
  ${dots
    .map(
      d =>
        `${mono ? '' : `<circle cx="${d.x}" cy="612" r="58" fill="#fff" opacity="${d.o * 0.55}" filter="url(#glow)"/>`}
         <circle cx="${d.x}" cy="612" r="38" fill="${ink}" opacity="${d.o}"/>`,
    )
    .join('')}
  <rect x="236" y="800" width="552" height="30" rx="15" fill="${mono ? ink : 'url(#strip)'}" ${mono ? 'opacity=".9"' : ''}/>
  ${mono ? '' : `<rect x="300" y="796" width="424" height="38" rx="19" fill="#fff" opacity=".45" filter="url(#glow)"/>`}`;
};

const wrap = (inner, clip) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs>${GRAD}${clip ?? ''}</defs>${inner}</svg>`;

const clipRounded = `<clipPath id="c"><rect width="1024" height="1024" rx="230"/></clipPath>`;
const clipCircle = `<clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath>`;
// Adaptive icons draw the foreground on a 108dp canvas of which only the central 66dp is
// guaranteed visible, so the mark is scaled into the inner ~61%.
const scaled = (m, s) => `<g transform="translate(512 512) scale(${s}) translate(-512 -520)">${m}</g>`;

const designs = {
  full: wrap(`${BACKGROUND}${mark()}`), // iOS / reference: full bleed, the OS rounds it
  rounded: wrap(`<g clip-path="url(#c)">${BACKGROUND}${mark()}</g>`, clipRounded), // Android legacy
  circle: wrap(`<g clip-path="url(#c)">${BACKGROUND}${scaled(mark(), 0.9)}</g>`, clipCircle), // Android legacy round
  background: wrap(BACKGROUND), // adaptive background
  foreground: wrap(scaled(mark(), 0.62)), // adaptive foreground (transparent)
  mono: wrap(scaled(mark(true), 0.62)), // adaptive monochrome (themed icons)
};

// ---------------------------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------------------------
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const jobs = [];
for (const [d, k] of Object.entries(dens)) {
  const dir = join(res, `mipmap-${d}`);
  jobs.push({ design: 'rounded', size: 48 * k, out: join(dir, 'ic_launcher.png') });
  jobs.push({ design: 'circle', size: 48 * k, out: join(dir, 'ic_launcher_round.png') });
  jobs.push({ design: 'background', size: 108 * k, out: join(dir, 'ic_launcher_background.png') });
  jobs.push({ design: 'foreground', size: 108 * k, out: join(dir, 'ic_launcher_foreground.png'), alpha: true });
  jobs.push({ design: 'mono', size: 108 * k, out: join(dir, 'ic_launcher_monochrome.png'), alpha: true });
}
const iosIcons = [
  ['iphone', 20, 2], ['iphone', 20, 3], ['iphone', 29, 2], ['iphone', 29, 3],
  ['iphone', 40, 2], ['iphone', 40, 3], ['iphone', 60, 2], ['iphone', 60, 3],
];
const images = iosIcons.map(([idiom, pt, scale]) => {
  const filename = `icon-${pt}@${scale}x.png`;
  jobs.push({ design: 'full', size: pt * scale, out: join(ios, filename) });
  return { filename, idiom, scale: `${scale}x`, size: `${pt}x${pt}` };
});
jobs.push({ design: 'full', size: 1024, out: join(ios, 'icon-1024.png') });
images.push({ filename: 'icon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' });

// Reference assets (leftovers from the Expo days kept in sync so nothing stale remains).
const assets = join(root, 'assets');
jobs.push({ design: 'full', size: 1024, out: join(assets, 'icon.png') });
jobs.push({ design: 'foreground', size: 1024, out: join(assets, 'android-icon-foreground.png'), alpha: true });
jobs.push({ design: 'background', size: 1024, out: join(assets, 'android-icon-background.png') });
jobs.push({ design: 'mono', size: 1024, out: join(assets, 'android-icon-monochrome.png'), alpha: true });
jobs.push({ design: 'rounded', size: 48, out: join(assets, 'favicon.png'), alpha: true });
jobs.push({ design: 'foreground', size: 1024, out: join(assets, 'splash-icon.png'), alpha: true });

// ---------------------------------------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  mkdirSync(dirname(j.out), { recursive: true });
  const size = Math.round(j.size);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${designs[j.design].replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`,
  );
  await page.screenshot({ path: j.out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();

// Master design as SVGs (source of truth, viewable/editable).
writeFileSync(join(assets, 'icon.svg'), designs.full + '\n');

writeFileSync(join(ios, 'Contents.json'), JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2) + '\n');

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
mkdirSync(join(res, 'mipmap-anydpi-v26'), { recursive: true });
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);

console.log(`Generated ${jobs.length} PNGs + adaptive XML + iOS Contents.json`);
