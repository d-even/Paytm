/**
 * Draws the placeholder illustrations in public/illustrations: clay-style
 * icon tiles, coins, confetti, and Mitra pose placeholders (the real Mitra art
 * plus a clay prop). Replace any file with final art of the same name.
 *
 *   node design/illustrations/placeholders.mjs      (needs Playwright + Chromium)
 *   python3 design/illustrations/to_webp.py         (PNG -> WebP under 60 KB)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const out = path.join(here, 'out')
fs.mkdirSync(out, { recursive: true })

const playwrightPath = process.env.PW ?? 'playwright'
const { chromium } = await import(playwrightPath.startsWith('/') ? pathToFileURL(path.join(playwrightPath, 'index.mjs')).href : playwrightPath)

async function glyph(name) {
  const file = path.join(root, 'node_modules/lucide-react/dist/esm/icons', `${name}.mjs`)
  const { __iconData } = await import(pathToFileURL(file).href)
  return __iconData.node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('')
}

const TONES = {
  cyan: ['#8fe6ff', '#1cc3f5', '#0086bd'],
  blue: ['#6fa3e6', '#2a67b8', '#123f82'],
  navy: ['#4c6fa8', '#133f7c', '#021e4d'],
  sky: ['#ffffff', '#c9f0fd', '#7ccbe8'],
  mint: ['#b9f3dc', '#4fd1a5', '#15936a'],
}

/** A puffy rounded tile with an embossed line glyph. */
async function tile(icon, tone, glyphColor = '#ffffff') {
  const [hi, mid, lo] = TONES[tone]
  const g = await glyph(icon)
  const shadowColor = tone === 'sky' ? '#2a67b8' : '#001a44'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <radialGradient id="face" cx="0.32" cy="0.26" r="0.95"><stop offset="0" stop-color="${hi}"/><stop offset="0.45" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="emboss" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="${shadowColor}" flood-opacity="0.35"/>
    </filter>
    <clipPath id="clip"><rect x="30" y="22" width="196" height="196" rx="62"/></clipPath>
  </defs>
  <ellipse cx="132" cy="226" rx="86" ry="14" fill="#002e6e" opacity="0.22" filter="url(#drop)"/>
  <rect x="30" y="22" width="196" height="196" rx="62" fill="url(#face)"/>
  <g clip-path="url(#clip)">
    <ellipse cx="92" cy="58" rx="62" ry="30" fill="#fff" opacity="0.38" filter="url(#soft)"/>
    <rect x="30" y="22" width="196" height="196" rx="62" fill="none" stroke="${lo}" stroke-width="18" opacity="0.35" filter="url(#soft)" transform="translate(6 8)"/>
  </g>
  <g transform="translate(66 58) scale(5.2)" fill="none" stroke="${glyphColor}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" filter="url(#emboss)">${g}</g>
</svg>`
}

function coins() {
  const coin = (cx, cy, s = 1) => `
    <g transform="translate(${cx} ${cy}) scale(${s})">
      <ellipse cx="0" cy="14" rx="58" ry="22" fill="#b7791f"/>
      <rect x="-58" y="0" width="116" height="14" fill="#c98a1f"/>
      <ellipse cx="0" cy="0" rx="58" ry="22" fill="url(#gold)"/>
      <ellipse cx="0" cy="0" rx="42" ry="14" fill="none" stroke="#fff3c4" stroke-width="4" opacity="0.8"/>
      <text x="0" y="8" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="700" font-size="24" fill="#a4670f">₹</text>
    </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <radialGradient id="gold" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#fff1b8"/><stop offset="0.5" stop-color="#f6c343"/><stop offset="1" stop-color="#d99a1e"/></radialGradient>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <ellipse cx="128" cy="222" rx="96" ry="14" fill="#002e6e" opacity="0.2" filter="url(#drop)"/>
  ${coin(118, 196)}${coin(126, 172)}${coin(114, 148)}${coin(130, 124)}
  <g transform="rotate(-18 190 70)">${coin(190, 70, 0.62)}</g>
</svg>`
}

function confetti() {
  const pieces = [
    ['rect', 40, 60, '#00b9f1', -20], ['circle', 86, 34, '#f6c343'], ['rect', 150, 40, '#2a67b8', 25],
    ['circle', 208, 76, '#4fd1a5'], ['rect', 196, 150, '#f6c343', -35], ['circle', 150, 206, '#00b9f1'],
    ['rect', 70, 190, '#4fd1a5', 40], ['circle', 36, 140, '#2a67b8'], ['rect', 118, 118, '#ff8fa3', 12],
    ['circle', 172, 104, '#ff8fa3'], ['rect', 96, 84, '#7fdcf8', 60], ['circle', 214, 206, '#2a67b8'],
  ]
  const draw = ([shape, x, y, c, r = 0]) =>
    shape === 'rect'
      ? `<rect x="${x - 14}" y="${y - 7}" width="28" height="14" rx="7" fill="${c}" transform="rotate(${r} ${x} ${y})" filter="url(#puff)"/>`
      : `<circle cx="${x}" cy="${y}" r="10" fill="${c}" filter="url(#puff)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs><filter id="puff" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="2" dy="4" stdDeviation="2.5" flood-color="#002e6e" flood-opacity="0.25"/>
  </filter></defs>
  ${pieces.map(draw).join('')}
  <path d="M60 120 q12 -16 24 0 t24 0" fill="none" stroke="#00b9f1" stroke-width="8" stroke-linecap="round" filter="url(#puff)"/>
  <path d="M168 176 q12 -16 24 0 t24 0" fill="none" stroke="#f6c343" stroke-width="8" stroke-linecap="round" filter="url(#puff)"/>
</svg>`
}

const TILES = {
  'insight-sales-dip': ['trending-down', 'cyan'],
  'insight-loyalty': ['heart-handshake', 'blue'],
  'insight-cash-crunch': ['wallet', 'navy'],
  'insight-reorder': ['package', 'sky', '#1d5aa8'],
  'loop-observe': ['eye', 'sky', '#1d5aa8'],
  'loop-reason': ['lightbulb', 'cyan'],
  'loop-decide': ['signpost', 'blue'],
  'loop-act': ['zap', 'navy'],
  'loop-learn': ['graduation-cap', 'mint'],
}

const svgs = {}
for (const [name, [icon, tone, color]] of Object.entries(TILES)) svgs[name] = await tile(icon, tone, color)
svgs['celebrate-coins'] = coins()
svgs['celebrate-confetti'] = confetti()

// Mitra poses: the real art with a clay prop, until final pose art arrives.
const mitra = `data:image/webp;base64,${fs.readFileSync(path.join(root, 'public/illustrations/mitra-wave.webp')).toString('base64')}`
const bubble = (text) => `<div style="position:absolute;right:26px;top:40px;width:190px;height:150px">
  <div style="position:absolute;inset:0;border-radius:80px;background:radial-gradient(circle at 30% 25%,#fff,#e3f7fe 70%,#bfe6f7);box-shadow:10px 14px 28px rgb(0 46 110/.16),inset -6px -8px 14px rgb(0 46 110/.08);display:flex;align-items:center;justify-content:center;gap:14px">${text}</div>
  <div style="position:absolute;left:-10px;bottom:-26px;width:34px;height:34px;border-radius:50%;background:#e8f7fe;box-shadow:6px 8px 14px rgb(0 46 110/.14)"></div>
  <div style="position:absolute;left:-34px;bottom:-54px;width:18px;height:18px;border-radius:50%;background:#e8f7fe;box-shadow:4px 5px 10px rgb(0 46 110/.14)"></div></div>`
const dot = (c) => `<span style="width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#8fe6ff,${c});box-shadow:2px 4px 6px rgb(0 46 110/.25)"></span>`
const poseProp = {
  'mitra-thinking': bubble(dot('#1cc3f5') + dot('#2a67b8') + dot('#133f7c')),
  'mitra-empty': `<div style="position:absolute;right:20px;bottom:30px;width:210px;height:210px">${svgImg(await tile('inbox', 'sky', '#1d5aa8'))}</div>`,
  'mitra-error': `<div style="position:absolute;right:30px;top:60px;width:190px;height:190px">${svgImg(await tile('wifi-off', 'navy'))}</div>`,
  'mitra-celebrate': `<div style="position:absolute;left:0;top:0;width:600px;height:600px;z-index:-1">${svgImg(confetti())}</div>
    <div style="position:absolute;right:10px;bottom:20px;width:200px;height:200px">${svgImg(coins())}</div>`,
}
function svgImg(svg, style = 'width:100%;height:100%;display:block') {
  const fluid = svg.replace('width="256" height="256"', 'width="100%" height="100%"')
  return `<img style="${style}" src="data:image/svg+xml;base64,${Buffer.from(fluid).toString('base64')}"/>`
}

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const [name, svg] of Object.entries(svgs)) {
  await page.setViewportSize({ width: 256, height: 256 })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  await page.screenshot({ path: path.join(out, `${name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 256, height: 256 } })
}
for (const [name, prop] of Object.entries(poseProp)) {
  await page.setViewportSize({ width: 600, height: 800 })
  await page.setContent(`<html><body style="margin:0;background:transparent;overflow:hidden">
    <div style="position:relative;width:600px;height:800px;isolation:isolate">
      <img src="${mitra}" style="position:absolute;left:10px;bottom:6px;height:770px"/>${prop}</div></body></html>`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(out, `${name}.png`), omitBackground: true, clip: { x: 0, y: 0, width: 600, height: 800 } })
}
await browser.close()
console.log('wrote', fs.readdirSync(out).length, 'PNGs to', out)
