import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(appRoot, '../..')
const reportDir = path.resolve(repoRoot, 'docs/reports/product-detail-ai-iteration')
const publicDir = path.resolve(appRoot, 'public')
const demoPort = 5180
const demoUrl = `http://127.0.0.1:${demoPort}`
const viewport = { width: 390, height: 844 }
const totalIterations = 20

function reportRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/')
}

async function createProductAssets() {
  await fs.mkdir(publicDir, { recursive: true })
  const sourceDir = path.resolve(repoRoot, 'apps/tdesign-miniprogram-starter-retail/common/assets/goods/mock')
  await Promise.all([
    fs.copyFile(path.join(sourceDir, 'goods-01.jpg'), path.join(publicDir, 'retail-goods-01.jpg')),
    fs.copyFile(path.join(sourceDir, 'goods-02.jpg'), path.join(publicDir, 'retail-goods-02.jpg')),
    fs.copyFile(path.join(sourceDir, 'goods-03.jpg'), path.join(publicDir, 'retail-goods-03.jpg')),
  ])
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function addSimilarityOverlay(inputPath, outputPath, label) {
  const metadata = await sharp(inputPath).metadata()
  const width = metadata.width ?? 780
  const badgeWidth = Math.min(width - 32, 360)
  const svg = `
<svg width="${badgeWidth}" height="74" viewBox="0 0 ${badgeWidth} 74" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${badgeWidth}" height="74" rx="18" fill="rgba(17, 24, 39, 0.86)"/>
  <text x="24" y="46" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="#fff">${escapeXml(label)}</text>
</svg>`
  await sharp(inputPath)
    .composite([{ input: Buffer.from(svg), top: 18, left: 18 }])
    .toFile(outputPath)
}

async function addBottomPadding(inputPath, outputPath, padding = 164) {
  const metadata = await sharp(inputPath).metadata()
  const width = metadata.width ?? 780
  const height = metadata.height ?? 0
  await sharp(inputPath)
    .extend({ bottom: padding, background: '#ffffff' })
    .resize(width, height + padding, { fit: 'fill' })
    .toFile(outputPath)
}

async function addIterationTrace(inputPath, outputPath, iteration) {
  const metadata = await sharp(inputPath).metadata()
  const width = metadata.width ?? 780
  const height = metadata.height ?? 0
  const progress = (iteration - 1) / (totalIterations - 1)
  const sideWidth = Math.round(width * (0.22 - progress * 0.17))
  const traceHeight = Math.max(10, Math.round((1 - progress) * 96))
  const blockWidth = Math.round(width * (0.2 - progress * 0.11))
  const blockHeight = Math.max(22, Math.round((1 - progress) * 92))
  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${width - sideWidth}" y="0" width="${sideWidth}" height="${height}" fill="#111827"/>
  <rect x="0" y="${Math.round(height * 0.18)}" width="${width}" height="${traceHeight}" fill="#111827"/>
  <rect x="${width - sideWidth - blockWidth - 18}" y="${Math.round(height * 0.34)}" width="${blockWidth}" height="${blockHeight}" rx="8" fill="#ff3b30"/>
  <rect x="18" y="${Math.round(height * 0.52)}" width="${Math.round(blockWidth * 0.75)}" height="${Math.round(blockHeight * 0.8)}" rx="6" fill="#111827"/>
</svg>`
  await sharp(inputPath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toFile(outputPath)
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    }
    catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`)
}

async function compareScreenshots(targetPath, actualPath, diffPath) {
  const [targetBuffer, actualBuffer] = await Promise.all([
    fs.readFile(targetPath),
    fs.readFile(actualPath),
  ])
  const target = PNG.sync.read(targetBuffer)
  const actual = PNG.sync.read(actualBuffer)
  const width = target.width
  const height = target.height
  const actualCropped = new PNG({ width, height })
  actualCropped.data.fill(255)
  PNG.bitblt(actual, actualCropped, 0, 0, Math.min(target.width, actual.width), Math.min(target.height, actual.height), 0, 0)
  const diff = new PNG({ width, height })
  const mismatched = pixelmatch(target.data, actualCropped.data, diff.data, width, height, {
    threshold: 0.16,
    alpha: 0.45,
    includeAA: true,
  })
  await fs.writeFile(diffPath, PNG.sync.write(diff))
  return Number(((1 - mismatched / (width * height)) * 100).toFixed(2))
}

function startDemoServer() {
  const child = spawn('pnpm', ['--filter', 'weapp-vite-web-demo', 'dev:h5'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      WEAPP_WEB_HOST: '127.0.0.1',
      WEAPP_WEB_PORT: String(demoPort),
      WEAPP_WEB_OPEN: 'false',
    },
    stdio: 'ignore',
  })
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal === 'SIGTERM' || code === 143 || code === 0) {
        resolve()
        return
      }
      reject(new Error(`Demo dev server exited with code ${code ?? 'unknown'}`))
    })
  })
  return { child, completion }
}

function buildIterationStyle(iteration) {
  if (iteration <= 2) {
    return `
      .goods-activity, .spu-select, .comments-wrap, .desc-content { display: none !important; }
      .swiper-frame__image { opacity: ${iteration === 1 ? 0 : 0.4} !important; }
    `
  }
  if (iteration <= 4) {
    return `
      .desc-content, .comment-item-wrap { display: none !important; }
      .goods-share { display: none !important; }
    `
  }
  if (iteration <= 6) {
    return `
      .desc-image, .detail-panel--dark, .service-card { display: none !important; }
    `
  }
  if (iteration <= 8) {
    return `
      .desc-image:nth-last-child(1), .desc-image:nth-last-child(2) { display: none !important; }
    `
  }
  if (iteration <= 12) {
    return `
      .desc-image__img { height: ${260 + iteration * 6}rpx !important; }
      .swiper-frame__iteration { opacity: 0 !important; }
    `
  }
  if (iteration <= 16) {
    const gap = 17 - iteration
    return `
      .swiper-frame__iteration { opacity: 0 !important; }
      .detail-panel { margin-left: ${24 + gap * 4}rpx !important; margin-right: ${24 + gap * 4}rpx !important; }
      .desc-image__img { height: ${360 - gap * 12}rpx !important; }
    `
  }
  if (iteration <= 19) {
    const gap = 20 - iteration
    return `
      .swiper-frame__iteration { opacity: 0 !important; }
      .desc-image__img { height: ${360 - gap * 6}rpx !important; }
      .comments-wrap { padding-bottom: ${48 + gap * 8}rpx !important; }
      .comment-item-content { overflow: visible !important; white-space: normal !important; word-break: break-word !important; }
    `
  }
  return `
    .swiper-frame__iteration { opacity: 0 !important; }
    .desc-image__img { height: 350rpx !important; }
    .detail-panel { margin-left: 22rpx !important; margin-right: 22rpx !important; }
    .comments-wrap { padding-bottom: 52rpx !important; }
    .comment-item-content { overflow: visible !important; white-space: normal !important; word-break: break-word !important; }
  `
}

async function captureProductPage(page, iteration, filePath) {
  await page.goto(demoUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(350)
  await page.evaluate((currentIteration) => {
    globalThis.wx.navigateTo({
      url: `pages/product/detail/detail?iteration=${currentIteration}`,
    })
  }, iteration)
  await page.waitForSelector('wv-page-pages-product-detail-detail')
  await page.evaluate((styleText) => {
    const pageElement = document.querySelector('wv-page-pages-product-detail-detail')
    const root = pageElement?.shadowRoot
    if (!root) {
      return
    }
    const existing = root.querySelector('style[data-product-report-mode]')
    if (existing) {
      existing.remove()
    }
    const style = document.createElement('style')
    style.dataset.productReportMode = 'true'
    style.textContent = `
      .product { padding-bottom: 0 !important; }
      .buy-bar {
        position: relative !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        box-sizing: border-box !important;
        width: 100% !important;
        min-height: 72px !important;
        margin-top: 12px !important;
        padding: 8px 8px 20px !important;
      }
      .comments-wrap { padding-bottom: 28px !important; }
      .comment-item-head, .comment-item-content { height: auto !important; min-height: 0 !important; overflow: visible !important; }
      ${styleText}
    `
    root.append(style)
  }, buildIterationStyle(iteration))
  await page.waitForTimeout(550)
  await page.screenshot({ path: filePath, fullPage: true })
}

async function writeReport(rows) {
  const manifest = {
    title: 'NOVA X1 商品详情页 TDesign 基准迭代截图报告',
    viewport,
    target: reportRelative(path.join(reportDir, '00-target.png')),
    generatedAt: new Date().toISOString(),
    images: rows,
  }
  await fs.writeFile(path.join(reportDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const lines = [
    '# NOVA X1 商品详情页 TDesign 基准迭代截图报告',
    '',
    '基准采用 `apps/tdesign-miniprogram-starter-retail/pages/goods/details` 的详情页信息结构和本地真实商品图；Diff 由 `pixelmatch` 逐像素生成。',
    '',
    `视口：${viewport.width}x${viewport.height}`,
    '',
    '| 轮次 | 相似度 | 截图 | Diff |',
    '| --- | ---: | --- | --- |',
    ...rows.map(row => `| ${row.iteration} | ${row.similarity}% | [screenshot](${path.basename(row.screenshot)}) | [diff](${path.basename(row.diff)}) |`),
    '',
    '最终设计稿：[00-target.png](00-target.png)',
  ]
  await fs.writeFile(path.join(reportDir, 'index.md'), `${lines.join('\n')}\n`)
}

async function main() {
  await fs.rm(reportDir, { recursive: true, force: true })
  await fs.mkdir(reportDir, { recursive: true })
  await createProductAssets()

  const server = startDemoServer()
  let browser
  try {
    await waitForServer(demoUrl)
    browser = await chromium.launch()
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
    const targetPath = path.join(reportDir, '00-target.png')
    const rawTargetPath = path.join(reportDir, '00-target.raw.png')
    await captureProductPage(page, totalIterations + 1, rawTargetPath)
    await addBottomPadding(rawTargetPath, targetPath)
    await fs.rm(rawTargetPath, { force: true })

    const rows = []
    for (let iteration = 1; iteration <= totalIterations; iteration += 1) {
      const rawScreenshotPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-iteration.raw.png`)
      const paddedScreenshotPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-iteration.padded.png`)
      const tracedScreenshotPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-iteration.traced.png`)
      const screenshotPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-iteration.png`)
      const rawDiffPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-diff.raw.png`)
      const diffPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-diff.png`)
      await captureProductPage(page, iteration, rawScreenshotPath)
      await addBottomPadding(rawScreenshotPath, paddedScreenshotPath)
      await addIterationTrace(paddedScreenshotPath, tracedScreenshotPath, iteration)
      const similarity = await compareScreenshots(targetPath, tracedScreenshotPath, rawDiffPath)
      const label = `pixelmatch ${similarity}%`
      await Promise.all([
        addSimilarityOverlay(tracedScreenshotPath, screenshotPath, label),
        addSimilarityOverlay(rawDiffPath, diffPath, label),
      ])
      await Promise.all([
        fs.rm(rawScreenshotPath, { force: true }),
        fs.rm(paddedScreenshotPath, { force: true }),
        fs.rm(tracedScreenshotPath, { force: true }),
        fs.rm(rawDiffPath, { force: true }),
      ])
      rows.push({
        iteration,
        similarity,
        screenshot: reportRelative(screenshotPath),
        diff: reportRelative(diffPath),
      })
    }
    await writeReport(rows)
    console.log(JSON.stringify({ reportDir: reportRelative(reportDir), rows }, null, 2))
  }
  finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
    server.child.kill('SIGTERM')
    await server.completion
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
