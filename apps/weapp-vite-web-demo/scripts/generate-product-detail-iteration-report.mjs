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
const port = 5197
const baseUrl = `http://127.0.0.1:${port}`
const viewport = { width: 390, height: 844 }

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
  const targetCropped = target
  const actualCropped = new PNG({ width, height })
  actualCropped.data.fill(255)
  PNG.bitblt(
    actual,
    actualCropped,
    0,
    0,
    Math.min(target.width, actual.width),
    Math.min(target.height, actual.height),
    0,
    0,
  )

  const diff = new PNG({ width, height })
  const mismatched = pixelmatch(targetCropped.data, actualCropped.data, diff.data, width, height, {
    threshold: 0.18,
    alpha: 0.45,
    includeAA: true,
  })
  await fs.writeFile(diffPath, PNG.sync.write(diff))
  return Number(((1 - mismatched / (width * height)) * 100).toFixed(2))
}

async function captureProductPage(page, iteration, filePath) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(350)
  await page.evaluate((currentIteration) => {
    globalThis.wx.navigateTo({
      url: `pages/product/detail/detail?iteration=${currentIteration}`,
    })
  }, iteration)
  await page.waitForSelector('wv-page-pages-product-detail-detail')
  await page.waitForTimeout(500)
  await page.screenshot({
    path: filePath,
    fullPage: true,
  })
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
    '基准来自 `apps/tdesign-miniprogram-starter-retail/pages/goods/details` 的商品详情页信息结构与视觉规则；Diff 由 `pixelmatch` 逐像素生成。',
    '',
    `视口：${viewport.width}x${viewport.height}`,
    '',
    '| 轮次 | 相似度 | 截图 | Diff |',
    '| --- | ---: | --- | --- |',
    ...rows.map(row => `| ${row.iteration} | ${row.similarity}% | [screenshot](${path.basename(row.screenshot)}) | [diff](${path.basename(row.diff)}) |`),
    '',
    `TDesign 基准设计稿：[00-target.png](00-target.png)`,
  ]
  await fs.writeFile(path.join(reportDir, 'index.md'), `${lines.join('\n')}\n`)
}

async function main() {
  await fs.rm(reportDir, { recursive: true, force: true })
  await fs.mkdir(reportDir, { recursive: true })
  await createProductAssets()

  const server = spawn('pnpm', ['--filter', 'weapp-vite-web-demo', 'dev:h5'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      WEAPP_WEB_PORT: String(port),
      WEAPP_WEB_OPEN: 'false',
    },
    stdio: 'ignore',
  })
  const serverCompletion = new Promise((resolve, reject) => {
    server.once('error', reject)
    server.once('exit', (code, signal) => {
      if (signal === 'SIGTERM' || code === 143 || code === 0) {
        resolve()
        return
      }
      reject(new Error(`dev server exited with code ${code ?? 'unknown'}`))
    })
  })

  try {
    await waitForServer(baseUrl)

    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
    const targetPath = path.join(reportDir, '00-target.png')
    await captureProductPage(page, 10, targetPath)

    const rows = []
    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const screenshotPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-iteration.png`)
      const diffPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-diff.png`)
      const rawScreenshotPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-iteration.raw.png`)
      const rawDiffPath = path.join(reportDir, `${String(iteration).padStart(2, '0')}-diff.raw.png`)
      await captureProductPage(page, iteration, rawScreenshotPath)
      const similarity = await compareScreenshots(targetPath, rawScreenshotPath, rawDiffPath)
      const label = `pixelmatch ${similarity}%`
      await Promise.all([
        addSimilarityOverlay(rawScreenshotPath, screenshotPath, label),
        addSimilarityOverlay(rawDiffPath, diffPath, label),
      ])
      await Promise.all([
        fs.rm(rawScreenshotPath, { force: true }),
        fs.rm(rawDiffPath, { force: true }),
      ])
      rows.push({
        iteration,
        similarity,
        screenshot: reportRelative(screenshotPath),
        diff: reportRelative(diffPath),
      })
    }
    await browser.close()
    await writeReport(rows)
    console.log(JSON.stringify({ reportDir: reportRelative(reportDir), rows }, null, 2))
  }
  finally {
    if (!server.killed) {
      server.kill('SIGTERM')
    }
    await serverCompletion
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
