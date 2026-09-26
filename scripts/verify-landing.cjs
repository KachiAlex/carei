// Verify the live landing page renders correctly
const { chromium } = require('@playwright/test')

const URL = 'https://www.careiapp.com/'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const errors = []
  const failed = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('requestfailed', (r) => failed.push(r.url() + ' :: ' + (r.failure()?.errorText || '')))
  page.on('response', (r) => { if (r.status() >= 400) failed.push(r.url() + ' :: HTTP ' + r.status()) })

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(2500) // let entrance animations + count-up settle

  const checks = {}

  // Hero
  checks['hero h1 text'] = (await page.locator('.hero h1').innerText()).replace(/\n/g, ' ')
  checks['hero badge visible'] = await page.locator('.hero-badge').isVisible()
  checks['desktop mockup visible'] = await page.locator('.desktop').isVisible()
  checks['voice card visible'] = await page.locator('.voice-card').isVisible()
  checks['metrics counted up'] = await page.locator('.metric b').allInnerTexts()

  // Reveal animation fired
  checks['hero-copy revealed'] = await page.locator('.hero-copy').evaluate((el) => el.classList.contains('show'))

  // Nav
  checks['nav links count'] = await page.locator('.nav-links a').count()

  // Tabs — click "Medication"
  await page.locator('.tab-btn', { hasText: 'Medication' }).scrollIntoViewIfNeeded()
  await page.locator('.tab-btn', { hasText: 'Medication' }).click()
  await page.waitForTimeout(600)
  checks['tab switch: MAR screen active'] = await page.locator('.feature-screen.active h4').innerText()
  checks['tab switch: copy title'] = await page.locator('.showcase-copy h3').innerText()
  await page.locator('.tab-btn', { hasText: 'Oversight' }).click()
  await page.waitForTimeout(600)
  checks['tab switch: oversight active'] = await page.locator('.feature-screen.active h4').innerText()

  // Pricing — live data
  await page.locator('#pricing').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  checks['price cards'] = await page.locator('.price-card').count()
  checks['plan names'] = await page.locator('.price-card .plan').allInnerTexts()
  checks['prices'] = await page.locator('.price-card .price').allInnerTexts()
  checks['featured card'] = await page.locator('.price-card.featured .plan').innerText()

  // AI demo typing — scroll into view triggers it
  await page.locator('.ai-demo').scrollIntoViewIfNeeded()
  await page.waitForTimeout(3500)
  checks['copilot prompt typed'] = await page.locator('.prompt').innerText()
  checks['copilot answer shown'] = await page.locator('.answer').isVisible()

  // Journey line + sections present
  checks['sections'] = {
    platform: await page.locator('#platform').count(),
    workflow: await page.locator('#workflow').count(),
    roles: await page.locator('#roles').count(),
    security: await page.locator('#security').count(),
    pricing: await page.locator('#pricing').count(),
  }
  checks['footer present'] = await page.locator('footer').isVisible()

  // Screenshots
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'verify-hero.png' })
  await page.locator('#platform').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'verify-platform.png' })
  await page.locator('#pricing').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'verify-pricing.png' })

  // Mobile viewport
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mob.goto(URL, { waitUntil: 'networkidle', timeout: 45000 })
  await mob.waitForTimeout(1500)
  await mob.screenshot({ path: 'verify-mobile.png' })
  checks['mobile hero h1'] = (await mob.locator('.hero h1').innerText()).slice(0, 40)
  checks['mobile overflow'] = await mob.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

  checks['console errors'] = errors
  checks['failed requests'] = failed

  console.log(JSON.stringify(checks, null, 2))
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
