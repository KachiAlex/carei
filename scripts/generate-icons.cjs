const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

const svgPath = path.join(__dirname, '..', 'public', 'favicon.svg')
const svg = fs.readFileSync(svgPath, 'utf-8')

// Android mipmap sizes
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res')

// Background color (dark navy from the app)
const bgColor = '#0f1a2e'

function createBackground(size) {
  const svgBg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bgColor}"/></svg>`
  const resvg = new Resvg(svgBg, { fitTo: { mode: 'width', value: size } })
  return resvg.render().asPng()
}

function renderSvg(size, padding = 0) {
  const opts = {
    fitTo: {
      mode: 'width',
      value: size - padding * 2,
    },
    background: 'transparent',
  }
  const resvg = new Resvg(svg, opts)
  return resvg.render().asPng()
}

async function composite(background, foreground, size) {
  // Use sharp for compositing if available, otherwise we'll just use the foreground
  // Since we don't have sharp reliably, we'll create a simple SVG composite
  const svgComposite = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${bgColor}"/>
    <image href="data:image/png;base64,${foreground.toString('base64')}" x="${Math.floor((size - (size * 0.6)) / 2)}" y="${Math.floor((size - (size * 0.6)) / 2)}" width="${Math.floor(size * 0.6)}" height="${Math.floor(size * 0.6)}"/>
  </svg>`
  const resvg = new Resvg(svgComposite, { fitTo: { mode: 'width', value: size } })
  return resvg.render().asPng()
}

async function generate() {
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(resDir, folder)
    fs.mkdirSync(dir, { recursive: true })

    // Foreground (adaptive icon) - icon with transparent background, slightly smaller
    const foregroundSize = Math.floor(size * 0.6)
    const foregroundPadding = Math.floor((size - foregroundSize) / 2)
    const foregroundOpts = {
      fitTo: { mode: 'width', value: foregroundSize },
      background: 'transparent',
    }
    const foregroundResvg = new Resvg(svg, foregroundOpts)
    const foregroundPng = foregroundResvg.render().asPng()
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), foregroundPng)

    // Regular launcher icon (square) and round icon
    const launcherPng = await composite(null, foregroundPng, size)
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), launcherPng)
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), launcherPng)

    console.log(`Generated ${folder} (${size}x${size})`)
  }

  // mipmap-anydpi-v26 adaptive icon XMLs
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26')
  fs.mkdirSync(anydpiDir, { recursive: true })

  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`)

  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`)

  // Create color resource for background
  const valuesDir = path.join(resDir, 'values')
  fs.mkdirSync(valuesDir, { recursive: true })
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${bgColor}</color>
</resources>`)

  // PWA manifest icons
  const publicDir = path.join(__dirname, '..', 'public')
  for (const size of [192, 512]) {
    const foregroundSize = Math.floor(size * 0.6)
    const foregroundOpts = {
      fitTo: { mode: 'width', value: foregroundSize },
      background: 'transparent',
    }
    const foregroundResvg = new Resvg(svg, foregroundOpts)
    const foregroundPng = foregroundResvg.render().asPng()
    const png = await composite(null, foregroundPng, size)
    fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), png)
    console.log(`Generated icon-${size}.png`)
  }

  console.log('All icons generated successfully!')
}

generate().catch(console.error)
