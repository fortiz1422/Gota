/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const SOURCE = path.join(__dirname, '..', 'gota-newlogo.png')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

const BG = '#F0F4F8'
const PADDING_RATIO = 0.06
const RADIUS_RATIO = 0.225

/** Remove near-white background → transparent */
async function removeWhiteBg(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) {
      data[i + 3] = 0
    }
  }

  return sharp(Buffer.from(data.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

/** Icon with #F0F4F8 background, rounded corners, centered logo with 8% padding */
async function generateIconWithBg(size, outFile) {
  const radius = Math.round(size * RADIUS_RATIO)
  const padding = Math.round(size * PADDING_RATIO)
  const logoSize = size - padding * 2

  const logoBuffer = await removeWhiteBg(SOURCE)
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BG}"/>
  </svg>`

  await sharp(Buffer.from(bgSvg))
    .composite([{ input: resizedLogo, left: padding, top: padding }])
    .png()
    .toFile(path.join(PUBLIC_DIR, outFile))

  console.log(`✓ ${outFile}`)
}

/** Logo on transparent background with 8% padding on all sides */
async function generateTransparentLogo(size, outFile) {
  const padding = Math.round(size * PADDING_RATIO)
  const logoSize = size - padding * 2

  const logoBuffer = await removeWhiteBg(SOURCE)
  await sharp(logoBuffer)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(PUBLIC_DIR, outFile))

  console.log(`✓ ${outFile}`)
}

/** Wrap a PNG buffer in a minimal ICO container */
function generateIco(pngPath, icoPath) {
  const png = fs.readFileSync(pngPath)

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: ICO
  header.writeUInt16LE(1, 4) // count: 1 image

  const entry = Buffer.alloc(16)
  entry.writeUInt8(32, 0)           // width
  entry.writeUInt8(32, 1)           // height
  entry.writeUInt8(0, 2)            // color count (0 = >256)
  entry.writeUInt8(0, 3)            // reserved
  entry.writeUInt16LE(0, 4)         // planes
  entry.writeUInt16LE(32, 6)        // bit count
  entry.writeUInt32LE(png.length, 8)  // image data size
  entry.writeUInt32LE(22, 12)         // offset (6 header + 16 entry)

  fs.writeFileSync(icoPath, Buffer.concat([header, entry, png]))
  console.log('✓ favicon.ico')
}

async function main() {
  console.log('Generating PWA icons from gota-newlogo.png...\n')

  await generateIconWithBg(192, 'icon-192.png')
  await generateIconWithBg(512, 'icon-512.png')
  await generateIconWithBg(180, 'apple-touch-icon.png')
  await generateIconWithBg(32, 'favicon-32.png')

  generateIco(
    path.join(PUBLIC_DIR, 'favicon-32.png'),
    path.join(PUBLIC_DIR, 'favicon.ico')
  )

  await generateTransparentLogo(320, 'logo-login.png')

  console.log('\nAll icons generated successfully!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
