import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const cwd = process.cwd()
const outDir = path.join(cwd, 'public', 'brand')
fs.mkdirSync(outDir, { recursive: true })

const latinSubsetFontPath = path.join(
  cwd,
  '.next',
  'dev',
  'static',
  'media',
  '5c285b27cdda1fe8-s.p.a62025f2.woff2',
)

if (!fs.existsSync(latinSubsetFontPath)) {
  throw new Error(`DM Sans font file not found: ${latinSubsetFontPath}`)
}

const fontBase64 = fs.readFileSync(latinSubsetFontPath).toString('base64')

const colors = {
  bg: '#F6F8FB',
  panel: '#FFFFFF',
  panelSoft: '#F8FBFD',
  line: 'rgba(33,120,168,0.09)',
  text: '#0D1829',
  textSecondary: '#4A6070',
  textDim: '#90A4B0',
  primary: '#2178A8',
  primarySoft: '#5BA8CC',
  white: '#FFFFFF',
}

const svg = String.raw`<svg width="1800" height="1320" viewBox="0 0 1800 1320" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'DM Sans Embedded';
        src: url("data:font/woff2;base64,${fontBase64}") format("woff2");
        font-weight: 100 900;
        font-style: normal;
      }
      .sans { font-family: 'DM Sans Embedded', sans-serif; }
      .title { font-family: 'DM Sans Embedded', sans-serif; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; fill: ${colors.text}; }
      .label { font-family: 'DM Sans Embedded', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; fill: ${colors.textDim}; }
      .note { font-family: 'DM Sans Embedded', sans-serif; font-size: 18px; font-weight: 500; letter-spacing: -0.02em; fill: ${colors.textSecondary}; }
      .spec { font-family: 'DM Sans Embedded', sans-serif; font-size: 15px; font-weight: 500; fill: ${colors.textSecondary}; }
      .word { font-family: 'DM Sans Embedded', sans-serif; font-weight: 800; letter-spacing: -0.06em; }
      .word-tight { font-family: 'DM Sans Embedded', sans-serif; font-weight: 800; letter-spacing: -0.055em; }
      .dot { font-family: 'DM Sans Embedded', sans-serif; font-weight: 800; letter-spacing: -0.06em; }
    </style>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2178A8"/>
      <stop offset="100%" stop-color="#1B6A93"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1220 300) rotate(124) scale(860 640)">
      <stop offset="0%" stop-color="rgba(255,255,255,0.22)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>

  <rect width="1800" height="1320" fill="${colors.bg}"/>
  <circle cx="1530" cy="140" r="220" fill="rgba(91,168,204,0.08)"/>
  <circle cx="210" cy="1140" r="180" fill="rgba(33,120,168,0.05)"/>

  <text x="108" y="94" class="label">Gota Logo Kit</text>
  <text x="108" y="142" class="title">Wordmark system derived from the current landing treatment of gota.</text>

  <rect x="72" y="180" width="1656" height="420" rx="36" fill="${colors.panel}" stroke="${colors.line}" stroke-width="2"/>
  <text x="108" y="228" class="label">Primary family</text>

  <text x="128" y="392" class="word" font-size="188" fill="${colors.text}">gota</text>
  <text x="530" y="392" class="dot" font-size="188" fill="${colors.primary}">.</text>
  <text x="128" y="452" class="spec">Primary wordmark · light surfaces · text-primary + primary dot</text>

  <rect x="920" y="252" width="692" height="148" rx="28" fill="url(#hero)"/>
  <rect x="920" y="252" width="692" height="148" rx="28" fill="url(#glow)"/>
  <text x="964" y="355" class="word" font-size="112" fill="${colors.white}">gota</text>
  <text x="1202" y="355" class="dot" font-size="112" fill="${colors.primarySoft}">.</text>
  <text x="920" y="452" class="spec">Inverse wordmark · blue-zone / dark hero · white letters + light-blue dot</text>

  <text x="128" y="560" class="word-tight" font-size="76" fill="${colors.text}">gota</text>
  <text x="287" y="560" class="dot" font-size="76" fill="${colors.primary}">.</text>
  <text x="128" y="600" class="spec">Micro-scale version · preserves point contrast at smaller UI sizes</text>

  <text x="920" y="560" class="word-tight" font-size="76" fill="${colors.text}">gota</text>
  <text x="1079" y="560" class="dot" font-size="76" fill="${colors.text}">.</text>
  <text x="920" y="600" class="spec">Monochrome utility · receipts, emboss, one-ink applications</text>

  <rect x="72" y="644" width="798" height="604" rx="36" fill="${colors.panel}" stroke="${colors.line}" stroke-width="2"/>
  <text x="108" y="692" class="label">Support marks</text>
  <circle cx="285" cy="892" r="118" fill="${colors.panelSoft}" stroke="${colors.line}" stroke-width="2"/>
  <text x="220" y="938" class="word" font-size="176" fill="${colors.text}">g</text>
  <text x="328" y="938" class="dot" font-size="176" fill="${colors.primary}">.</text>
  <text x="108" y="1092" class="spec">Monogram · avatar / favicon direction</text>
  <text x="108" y="1122" class="spec">Extracted from the same typographic voice.</text>

  <rect x="506" y="796" width="252" height="252" rx="56" fill="url(#hero)"/>
  <rect x="506" y="796" width="252" height="252" rx="56" fill="url(#glow)"/>
  <text x="558" y="952" class="word" font-size="146" fill="${colors.white}">g</text>
  <text x="648" y="952" class="dot" font-size="146" fill="${colors.primarySoft}">.</text>
  <text x="506" y="1092" class="spec">App tile direction · high-contrast splash</text>
  <text x="506" y="1122" class="spec">Launcher or startup usage.</text>

  <rect x="906" y="644" width="822" height="604" rx="36" fill="${colors.panel}" stroke="${colors.line}" stroke-width="2"/>
  <text x="942" y="692" class="label">Usage rules</text>

  <text x="942" y="790" class="word" font-size="120" fill="${colors.text}">gota</text>
  <text x="1199" y="790" class="dot" font-size="120" fill="${colors.primary}">.</text>

  <line x1="930" y1="828" x2="1710" y2="828" stroke="${colors.line}" stroke-width="2"/>
  <line x1="930" y1="988" x2="1710" y2="988" stroke="${colors.line}" stroke-width="2"/>
  <line x1="1196" y1="716" x2="1196" y2="818" stroke="rgba(33,120,168,0.25)" stroke-width="2" stroke-dasharray="8 8"/>
  <line x1="1288" y1="716" x2="1288" y2="818" stroke="rgba(33,120,168,0.25)" stroke-width="2" stroke-dasharray="8 8"/>

  <text x="942" y="874" class="note">Clear space</text>
  <text x="942" y="908" class="spec">Use one dot diameter around the mark as minimum breathing room.</text>

  <text x="942" y="1034" class="note">Color logic</text>
  <text x="942" y="1068" class="spec">Letters stay neutral. The dot carries brand temperature.</text>

  <text x="942" y="1148" class="note">Do not</text>
  <text x="942" y="1182" class="spec">Do not add outlines, gradients on the word, or alternate expressive type.</text>

  <text x="108" y="1280" class="label">Current system anchors</text>
  <text x="320" y="1280" class="spec">DM Sans ExtraBold · tracking compacta · text-primary #0D1829 · primary #2178A8 · hero dot #5BA8CC</text>
</svg>`

const outputs = [
  {
    name: 'gota-logo-kit.svg',
    content: svg,
  },
  {
    name: 'gota-wordmark-primary.svg',
    content: String.raw`<svg width="640" height="180" viewBox="0 0 640 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @font-face {
            font-family: 'DM Sans Embedded';
            src: url("data:font/woff2;base64,${fontBase64}") format("woff2");
            font-weight: 100 900;
            font-style: normal;
          }
          .word { font-family: 'DM Sans Embedded', sans-serif; font-weight: 800; letter-spacing: -0.06em; }
        </style>
      </defs>
      <rect width="640" height="180" fill="transparent"/>
      <text x="20" y="126" class="word" font-size="128" fill="${colors.text}">gota</text>
      <text x="295" y="126" class="word" font-size="128" fill="${colors.primary}">.</text>
    </svg>`,
  },
  {
    name: 'gota-wordmark-inverse.svg',
    content: String.raw`<svg width="640" height="180" viewBox="0 0 640 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @font-face {
            font-family: 'DM Sans Embedded';
            src: url("data:font/woff2;base64,${fontBase64}") format("woff2");
            font-weight: 100 900;
            font-style: normal;
          }
          .word { font-family: 'DM Sans Embedded', sans-serif; font-weight: 800; letter-spacing: -0.06em; }
        </style>
        <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2178A8"/>
          <stop offset="100%" stop-color="#1B6A93"/>
        </linearGradient>
      </defs>
      <rect width="640" height="180" rx="28" fill="url(#hero)"/>
      <text x="20" y="126" class="word" font-size="128" fill="${colors.white}">gota</text>
      <text x="295" y="126" class="word" font-size="128" fill="${colors.primarySoft}">.</text>
    </svg>`,
  },
  {
    name: 'gota-monogram-g-dot.svg',
    content: String.raw`<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @font-face {
            font-family: 'DM Sans Embedded';
            src: url("data:font/woff2;base64,${fontBase64}") format("woff2");
            font-weight: 100 900;
            font-style: normal;
          }
          .word { font-family: 'DM Sans Embedded', sans-serif; font-weight: 800; letter-spacing: -0.06em; }
        </style>
      </defs>
      <rect width="256" height="256" rx="56" fill="#F8FBFD"/>
      <text x="42" y="169" class="word" font-size="152" fill="${colors.text}">g</text>
      <text x="137" y="169" class="word" font-size="152" fill="${colors.primary}">.</text>
    </svg>`,
  },
]

for (const output of outputs) {
  fs.writeFileSync(path.join(outDir, output.name), output.content)
}

await sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(outDir, 'gota-logo-kit.png'))

console.log(`Generated logo kit assets in ${outDir}`)
