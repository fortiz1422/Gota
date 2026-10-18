/* eslint-disable @typescript-eslint/no-require-imports -- next/font loads mocked responses through require(). */
// QA-only, offline font responses. No font configuration in the app is changed.
const path = require('node:path')
const fontRoot =
  process.env.GOTA_QA_FONTS_ROOT || '/tmp/gota-fonts/node_modules'
const families = {
  Geist: path.resolve(
    __dirname,
    '../../..',
    'node_modules/next/dist/next-devtools/server/font/geist-latin.woff2'
  ),
  'DM Sans': path.join(
    fontRoot,
    '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2'
  ),
  'DM Mono': path.join(
    fontRoot,
    '@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2'
  ),
}
const urls = [
  'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap',
  'https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap',
]
module.exports = Object.fromEntries(
  urls.map((url) => {
    const name = new URL(url).searchParams.get('family').split(':')[0]
    return [
      url,
      `/* latin */\n@font-face { font-family: '${name}'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(${families[name]}) format('woff2'); }`,
    ]
  })
)
