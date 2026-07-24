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
    id: 'navigation-matrix',
    route: '/pages/navigation-parity/index',
    baseline: 'navigation-matrix.png',
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

async function captureBaselines(miniProgram: MiniProgram, device: DeviceMetrics) {
  await fs.mkdir(BASELINE_ROOT, { recursive: true })
  let screenshotScale: number | undefined
  for (const visualCase of visualCases) {
    await miniProgram.reLaunch(visualCase.route)
    await sleep(1_200)
    const screenshot = await miniProgram.screenshot({ timeout: SCREENSHOT_TIMEOUT })
    const screenshotBuffer = typeof screenshot === 'string'
      ? Buffer.from(screenshot, 'base64')
      : Buffer.from(screenshot)
    const png = PNG.sync.read(screenshotBuffer)
    const currentScale = png.width / device.windowWidth
    if (!Number.isFinite(currentScale) || currentScale <= 0) {
      throw new TypeError(`[web-visual] ${visualCase.baseline} 的截图尺寸无效`)
    }
    if (screenshotScale !== undefined && screenshotScale !== currentScale) {
      throw new TypeError('[web-visual] DevTools 基线截图缩放比例不一致')
    }
    screenshotScale = currentScale
    await fs.writeFile(path.join(BASELINE_ROOT, visualCase.baseline), screenshotBuffer)
    process.stdout.write(`[web-visual] updated ${visualCase.baseline} (${device.windowWidth}x${device.windowHeight}@${device.pixelRatio})\n`)
  }
  if (screenshotScale === undefined) {
    throw new TypeError('[web-visual] 未生成任何基线截图')
  }
  return screenshotScale
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
    const screenshotScale = await captureBaselines(miniProgram, device)
    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      device: {
        ...device,
        screenshotScale,
      },
      cases: visualCases,
    }
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
