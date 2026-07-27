import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { componentScenarios } from '../../e2e-apps/wot-ui-compat/src/scenarios'
import { comparePngWithBaseline } from '../../packages/weapp-ide-cli/src/cli/imageDiff'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { assertNonBlankPng } from '../wot-ui-compat/webHarness'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'e2e-apps/wot-ui-compat')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const BASELINE_ROOT = path.join(ROOT, 'e2e/ide/baselines/wot-ui-compat/wechat')
const OUTPUT_ROOT = path.join(ROOT, '.tmp/wot-ui-compat/wechat')
const UPDATE_BASELINES = process.env.WOT_UI_UPDATE_WECHAT_BASELINES === '1'
const MAX_RUNTIME_ERRORS_PER_ROUTE = 20
const PAGE_READY_TIMEOUT = 20_000
const runtimeProvider = resolveRuntimeProviderName()
const componentFilter = new Set(
  (process.env.WOT_UI_COMPONENT_FILTER ?? '')
    .split(',')
    .map(component => component.trim())
    .filter(Boolean),
)
const scenarios = componentFilter.size > 0
  ? componentScenarios.filter(scenario => componentFilter.has(scenario.component))
  : componentScenarios

function reportProgress(message: string) {
  process.stderr.write(`[wot-ui][${runtimeProvider}] ${message}\n`)
}

interface PageScenarioResult {
  component?: string
  interactionCount?: number
  ok?: boolean
  rendered?: boolean
  state?: string
}

function normalizeConsolePayload(entry: any) {
  return entry?.entry ?? entry?.message ?? entry
}

function readConsoleError(entry: any) {
  const payload = normalizeConsolePayload(entry)
  const level = String(payload?.level ?? payload?.type ?? '').toLowerCase()
  if (level !== 'error') {
    return null
  }
  if (typeof payload?.text === 'string') {
    return payload.text
  }
  return JSON.stringify(payload)
}

async function buildApplication() {
  await fs.rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    skipNpm: true,
    label: `wot-ui-compat:${runtimeProvider}`,
  })
}

async function captureWechatScreenshot(miniProgram: any, component: string) {
  const baselinePath = path.join(BASELINE_ROOT, `${component}.png`)
  const currentPath = path.join(OUTPUT_ROOT, `${component}.current.png`)
  const diffPath = path.join(OUTPUT_ROOT, `${component}.diff.png`)
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
  if (UPDATE_BASELINES) {
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

async function waitForScenarioReady(page: any, component: string) {
  if (typeof page?.waitForRendered === 'function') {
    await page.waitForRendered({
      selector: '#e2e-root',
      timeout: PAGE_READY_TIMEOUT,
    })
    return
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt <= PAGE_READY_TIMEOUT) {
    const root = await page?.$('#e2e-root')
    if (root) {
      return
    }
    await page.waitFor(220)
  }

  throw new Error(`${component}: 等待 #e2e-root 渲染超时`)
}

describe.sequential(`Wot UI 2.2.0 全组件运行时兼容 [${runtimeProvider}]`, () => {
  let miniProgram: any
  let activeRoute = ''
  const runtimeErrorsByRoute = new Map<string, Set<string>>()

  beforeAll(async () => {
    reportProgress('build')
    await buildApplication()
    reportProgress('launch')
    miniProgram = await launchAutomator({
      launchMode: 'direct',
      projectPath: APP_ROOT,
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
    miniProgram.on?.('console', (entry: unknown) => {
      const error = readConsoleError(entry)
      if (error) {
        const route = activeRoute || '<launch>'
        const routeErrors = runtimeErrorsByRoute.get(route) ?? new Set<string>()
        if (routeErrors.size < MAX_RUNTIME_ERRORS_PER_ROUTE) {
          routeErrors.add(error)
        }
        else {
          routeErrors.add(`更多运行时错误已省略（最多记录 ${MAX_RUNTIME_ERRORS_PER_ROUTE} 条）`)
        }
        runtimeErrorsByRoute.set(route, routeErrors)
      }
    })
  }, 180_000)

  afterAll(async () => {
    reportProgress('close')
    await miniProgram?.close?.()
    reportProgress('closed')
  }, 60_000)

  it('逐页完成 99 个组件的渲染、交互与状态断言', async () => {
    const failures: string[] = []
    for (const [index, scenario] of scenarios.entries()) {
      reportProgress(`${index + 1}/${scenarios.length} ${scenario.component}`)
      activeRoute = scenario.route
      runtimeErrorsByRoute.delete(activeRoute)
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
        await page.waitFor(260)
        if (runtimeProvider === 'devtools') {
          await captureWechatScreenshot(miniProgram, scenario.component)
        }
      }
      catch (error) {
        failures.push(`${scenario.component}: ${error instanceof Error ? error.message : String(error)}`)
      }
      const routeErrors = [...(runtimeErrorsByRoute.get(activeRoute) ?? [])]
      for (const error of routeErrors) {
        failures.push(`${scenario.component}: console ${activeRoute}: ${error}`)
      }
    }

    reportProgress(`assert failures=${failures.length}`)
    expect(componentScenarios).toHaveLength(99)
    expect(scenarios.length).toBeGreaterThan(0)
    expect(failures, failures.join('\n')).toEqual([])
    reportProgress('asserted')
  })
})
