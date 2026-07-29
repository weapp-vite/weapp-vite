import type { ComponentScenarioLike } from './webHarness'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { comparePngWithBaseline } from '../../packages/weapp-ide-cli/src/cli/imageDiff'
import { attachRuntimeErrorCollector } from '../ide/runtimeErrors'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { assertNonBlankPng } from './webHarness'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const PAGE_READY_TIMEOUT = 20_000
const SCREENSHOT_SETTLE_MS = 700

interface PageScenarioResult {
  component?: string
  interactionCount?: number
  ok?: boolean
  rendered?: boolean
  state?: string
}

export interface ComponentLibraryRuntimeSuiteOptions {
  appRoot: string
  baselineRoot: string
  componentFilterEnv: string
  expectedCount: number
  outputRoot: string
  progressLabel: string
  scenarios: readonly ComponentScenarioLike[]
  suiteName: string
  testTimeout?: number
  updateBaselinesEnv: string
}

async function waitForScenarioReady(page: any, component: string) {
  if (typeof page?.waitForRendered === 'function') {
    await page.waitForRendered({ selector: '#e2e-root', timeout: PAGE_READY_TIMEOUT })
    return
  }
  const startedAt = Date.now()
  while (Date.now() - startedAt <= PAGE_READY_TIMEOUT) {
    if (await page?.$('#e2e-root')) {
      return
    }
    await page.waitFor(220)
  }
  throw new Error(`${component}: 等待 #e2e-root 渲染超时`)
}

export function defineComponentLibraryRuntimeSuite(options: ComponentLibraryRuntimeSuiteOptions) {
  const runtimeProvider = resolveRuntimeProviderName()
  const appRoot = path.join(ROOT, options.appRoot)
  const distRoot = path.join(appRoot, 'dist')
  const baselineRoot = path.join(ROOT, options.baselineRoot)
  const outputRoot = path.join(ROOT, options.outputRoot)
  const updateBaselines = process.env[options.updateBaselinesEnv] === '1'
  const componentFilter = new Set(
    (process.env[options.componentFilterEnv] ?? '')
      .split(',')
      .map(component => component.trim())
      .filter(Boolean),
  )
  const scenarios = componentFilter.size > 0
    ? options.scenarios.filter(scenario => componentFilter.has(scenario.component))
    : options.scenarios
  const reportProgress = (message: string) => {
    process.stderr.write(`[${options.progressLabel}][${runtimeProvider}] ${message}\n`)
  }

  async function captureWechatScreenshot(miniProgram: any, component: string) {
    const baselinePath = path.join(baselineRoot, `${component}.png`)
    const currentPath = path.join(outputRoot, `${component}.current.png`)
    const diffPath = path.join(outputRoot, `${component}.diff.png`)
    await fs.mkdir(path.dirname(currentPath), { recursive: true })
    let screenshot: Buffer | undefined
    let screenshotError: unknown
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const rawScreenshot = await miniProgram.screenshot({ timeout: 15_000 })
        screenshot = typeof rawScreenshot === 'string'
          ? Buffer.from(rawScreenshot, 'base64')
          : Buffer.from(rawScreenshot)
        await fs.writeFile(currentPath, screenshot)
        assertNonBlankPng(screenshot, `wechat/${component}`)
        screenshotError = undefined
        break
      }
      catch (error) {
        screenshotError = error
        await new Promise(resolve => setTimeout(resolve, 400))
      }
    }
    if (!screenshot || screenshotError) {
      throw screenshotError ?? new Error(`wechat/${component}: 截图未返回有效图像`)
    }
    if (updateBaselines) {
      await fs.mkdir(path.dirname(baselinePath), { recursive: true })
      await fs.writeFile(baselinePath, screenshot)
      return
    }
    const result = await comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: screenshot,
      diffOutputPath: diffPath,
      threshold: 0.18,
    })
    if (result.diffRatio > 0.03) {
      throw new Error(`wechat/${component}: diffRatio=${result.diffRatio}`)
    }
  }

  describe.sequential(`${options.suiteName} [${runtimeProvider}]`, () => {
    let miniProgram: any
    let runtimeErrorCollector: ReturnType<typeof attachRuntimeErrorCollector>

    beforeAll(async () => {
      expect(options.scenarios).toHaveLength(options.expectedCount)
      reportProgress('build')
      await fs.rm(distRoot, { recursive: true, force: true })
      await runWeappViteBuildWithLogCapture({
        cliPath: CLI_PATH,
        projectRoot: appRoot,
        platform: 'weapp',
        skipNpm: true,
        label: `${options.progressLabel}:${runtimeProvider}`,
      })
      reportProgress('launch')
      miniProgram = await launchAutomator({
        launchMode: 'direct',
        projectPath: appRoot,
        projectConfig: {
          setting: {
            useIsolateContext: false,
            useMultiFrameRuntime: false,
          },
        },
        skipRelaunchPageRootCheck: true,
        skipWarmup: true,
        timeout: 120_000,
      })
      reportProgress('ready')
      runtimeErrorCollector = attachRuntimeErrorCollector(miniProgram)
    }, 180_000)

    afterAll(async () => {
      reportProgress('close')
      runtimeErrorCollector?.dispose()
      await miniProgram?.close?.()
      reportProgress('closed')
    }, 60_000)

    it(`逐页完成 ${options.expectedCount} 个组件的渲染、交互与状态断言`, { timeout: options.testTimeout ?? 1_200_000 }, async () => {
      const failures: string[] = []
      for (const [index, scenario] of scenarios.entries()) {
        reportProgress(`${index + 1}/${scenarios.length} ${scenario.component}`)
        const runtimeErrorMarker = runtimeErrorCollector.mark()
        try {
          const page = await miniProgram.reLaunch(scenario.route)
          if (!page) {
            failures.push(`${scenario.component}: reLaunch 未返回页面`)
            continue
          }
          await waitForScenarioReady(page, scenario.component)
          const result = await page.callMethod('runE2E') as PageScenarioResult
          if (result.component !== scenario.component) {
            failures.push(`${scenario.component}: bridge component=${result.component ?? '<missing>'}`)
          }
          if (!result.rendered || !result.ok || !result.state?.startsWith(scenario.expectedState)) {
            failures.push(`${scenario.component}: expected=${scenario.expectedState}, result=${JSON.stringify(result)}`)
          }
          await page.waitFor(SCREENSHOT_SETTLE_MS)
          if (runtimeProvider === 'devtools') {
            await captureWechatScreenshot(miniProgram, scenario.component)
          }
        }
        catch (error) {
          failures.push(`${scenario.component}: ${error instanceof Error ? error.message : String(error)}`)
        }
        for (const error of runtimeErrorCollector.getSince(runtimeErrorMarker)) {
          failures.push(`${scenario.component}: runtime ${scenario.route}: ${error}`)
        }
      }
      reportProgress(`assert failures=${failures.length}`)
      expect(scenarios.length).toBeGreaterThan(0)
      expect(failures, failures.join('\n')).toEqual([])
      reportProgress('asserted')
    })
  })
}
