/* eslint-disable e18e/ban-dependencies -- 基线更新器需要 execa 以跨平台方式执行应用构建。 */
import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'
import { PNG } from 'pngjs'
import { launchAutomator } from '../utils/automator'
import { cleanupResidualDevtoolsProcesses } from '../utils/ide-devtools-cleanup'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'apps/weapp-vite-web-demo')
const BASELINE_ROOT = path.join(ROOT, 'e2e/web-runtime/baselines/weapp')
const AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH'
const SCREENSHOT_TIMEOUT = 60_000
const SCREENSHOT_ATTEMPTS = 3

interface DeviceMetrics {
  windowWidth: number
  windowHeight: number
  pixelRatio: number
  safeAreaInsetBottom: number
}

const visualCases = [
  {
    id: 'component-matrix',
    route: '/pages/visual-parity/index',
    baseline: 'component-matrix.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'form-matrix',
    route: '/pages/form-parity/index',
    baseline: 'form-matrix.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'selection-matrix',
    route: '/pages/selection-parity/index',
    baseline: 'selection-matrix.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'display-matrix',
    route: '/pages/display-parity/index',
    baseline: 'display-matrix.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'navigation-matrix',
    route: '/pages/navigation-parity/index',
    baseline: 'navigation-matrix.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'media-matrix',
    route: '/pages/media-parity/index',
    baseline: 'media-matrix.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'layer-matrix',
    route: '/pages/layer-parity/index',
    baseline: 'layer-matrix.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'app-shell-tabbar',
    route: '/pages/tabbar-parity/home',
    baseline: 'app-shell-tabbar.png',
    threshold: 0.18,
    maxDiffRatio: 0.03,
  },
  {
    id: 'product-detail',
    route: '/pages/product/detail/detail?iteration=10',
    baseline: 'product-detail.png',
    threshold: 0.18,
    maxDiffRatio: 0.05,
  },
] as const

function resolveDeviceMetrics(value: unknown): DeviceMetrics {
  if (!value || typeof value !== 'object') {
    throw new TypeError('[web-visual] DevTools 未返回有效的设备信息')
  }
  const info = value as Record<string, unknown>
  const windowWidth = Number(info.windowWidth)
  const windowHeight = Number(info.windowHeight)
  const pixelRatio = Number(info.pixelRatio)
  const screenHeight = Number(info.screenHeight ?? windowHeight)
  const safeArea = info.safeArea as Record<string, unknown> | undefined
  const safeAreaBottom = Number(safeArea?.bottom ?? screenHeight)
  if (![windowWidth, windowHeight, pixelRatio].every(Number.isFinite)) {
    throw new TypeError('[web-visual] DevTools 设备信息缺少 windowWidth/windowHeight/pixelRatio')
  }
  return {
    windowWidth,
    windowHeight,
    pixelRatio,
    safeAreaInsetBottom: Number.isFinite(screenHeight) && Number.isFinite(safeAreaBottom)
      ? Math.max(0, screenHeight - safeAreaBottom)
      : 0,
  }
}

async function buildMiniProgram() {
  await execa('pnpm', ['--filter', 'weapp-vite-web-demo', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
}

function normalizeRoute(route: string) {
  return route.split('?')[0]!.replace(/^\/+|\/+$/g, '')
}

async function reLaunchVisualCase(miniProgram: MiniProgram, route: string) {
  const expectedRoute = normalizeRoute(route)
  let lastRoute = ''
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await miniProgram.reLaunch(route)
    const deadline = Date.now() + 8_000
    while (Date.now() < deadline) {
      const page = await miniProgram.currentPage()
      lastRoute = String(page.path ?? '')
      if (normalizeRoute(lastRoute) === expectedRoute) {
        return page
      }
      await sleep(200)
    }
  }
  throw new Error(`[web-visual] route mismatch: expected ${expectedRoute}, actual ${lastRoute || '<empty>'}`)
}

async function waitForVisualCaseReady(miniProgram: MiniProgram, id: string) {
  if (id !== 'display-matrix') {
    await sleep(1_200)
    return
  }
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const page = await miniProgram.currentPage()
    if (await page.data('progressEvent') === 'activeend') {
      return
    }
    await sleep(100)
  }
  throw new Error('[web-visual] display-matrix 未在截图前进入稳定状态')
}

async function captureScreenshot(miniProgram: MiniProgram, baseline: string) {
  let lastError: unknown
  for (let attempt = 1; attempt <= SCREENSHOT_ATTEMPTS; attempt += 1) {
    try {
      const screenshot = await miniProgram.screenshot({ timeout: SCREENSHOT_TIMEOUT })
      return typeof screenshot === 'string'
        ? Buffer.from(screenshot, 'base64')
        : Buffer.from(screenshot)
    }
    catch (error) {
      lastError = error
      process.stderr.write(`[web-visual] ${baseline} screenshot attempt ${attempt}/${SCREENSHOT_ATTEMPTS} failed\n`)
      await sleep(1_000)
    }
  }
  throw lastError
}

async function captureBaselines(miniProgram: MiniProgram, device: DeviceMetrics) {
  await fs.mkdir(BASELINE_ROOT, { recursive: true })
  let screenshotScale: number | undefined
  const screenshots: Array<{ baseline: string, buffer: Buffer }> = []
  const capturedCases: Array<(typeof visualCases)[number] & {
    viewport: { width: number, height: number }
  }> = []
  for (const visualCase of visualCases) {
    await reLaunchVisualCase(miniProgram, visualCase.route)
    await waitForVisualCaseReady(miniProgram, visualCase.id)
    const screenshotBuffer = await captureScreenshot(miniProgram, visualCase.baseline)
    const png = PNG.sync.read(screenshotBuffer)
    const currentScale = png.width / device.windowWidth
    if (!Number.isFinite(currentScale) || currentScale <= 0) {
      throw new TypeError(`[web-visual] ${visualCase.baseline} 的截图尺寸无效`)
    }
    if (screenshotScale !== undefined && screenshotScale !== currentScale) {
      throw new TypeError('[web-visual] DevTools 基线截图缩放比例不一致')
    }
    screenshotScale = currentScale
    capturedCases.push({
      ...visualCase,
      viewport: {
        width: png.width / currentScale,
        height: png.height / currentScale,
      },
    })
    screenshots.push({ baseline: visualCase.baseline, buffer: screenshotBuffer })
    process.stdout.write(`[web-visual] updated ${visualCase.baseline} (${device.windowWidth}x${device.windowHeight}@${device.pixelRatio})\n`)
  }
  if (screenshotScale === undefined) {
    throw new TypeError('[web-visual] 未生成任何基线截图')
  }
  return { cases: capturedCases, screenshotScale, screenshots }
}

async function main() {
  process.env[AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH_ENV] = '1'
  await cleanupResidualDevtoolsProcesses()
  await buildMiniProgram()

  let miniProgram: MiniProgram | undefined
  try {
    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      timeout: 90_000,
    })
    const device = resolveDeviceMetrics(await miniProgram.evaluate(() => {
      return wx.getSystemInfoSync()
    }))
    await miniProgram.waitForAppReady(SCREENSHOT_TIMEOUT)
    const captured = await captureBaselines(miniProgram, device)
    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      device: {
        ...device,
        screenshotScale: captured.screenshotScale,
      },
      cases: captured.cases,
    }
    await Promise.all(captured.screenshots.map(async screenshot => fs.writeFile(
      path.join(BASELINE_ROOT, screenshot.baseline),
      screenshot.buffer,
    )))
    await fs.writeFile(
      path.join(BASELINE_ROOT, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    )
  }
  finally {
    await miniProgram?.close().catch(() => {})
  }
}

await main()
