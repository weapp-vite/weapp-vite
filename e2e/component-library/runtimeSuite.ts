import type { ComponentScenarioLike } from './webHarness'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { comparePngWithBaseline } from '../../packages/weapp-ide-cli/src/cli/imageDiff'
import { attachRuntimeErrorCollector } from '../ide/runtimeErrors'
import { launchAutomator, resetAutomatorRuntimeLogs } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { cleanupDevtoolsScreenshotArtifacts } from '../utils/ide-devtools-screenshot-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import {
  resolveComponentLibraryRuntimeMode,
  selectComponentLibraryScenarios,
  shouldCaptureComponentLibraryScreenshot,
  shouldRecoverComponentLibrarySession,
  shouldRotateComponentLibrarySession,
} from './runtimePolicy'
import { assertNonBlankPng } from './webHarness'
import { normalizeWechatViewportScreenshot } from './wechatScreenshot'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const PAGE_READY_TIMEOUT = 20_000
const DEFAULT_SCREENSHOT_SETTLE_MS = 100
const DEVTOOLS_SCREENSHOT_SESSION_LIMIT = 20
const DEVTOOLS_SCENARIO_ATTEMPTS = 2
const FAST_METHOD_ROOT_CONFIRM_THRESHOLD_MS = 1_000
const DEFAULT_SESSION_READY_ROUTE = '/pages/index/index'
const DEFAULT_SESSION_READY_SELECTOR = '.index-page'
const SCENARIO_READY_SELECTOR = '#e2e-root'
const SUITE_SETUP_TIMEOUT = 300_000
const WECHAT_SCREENSHOT_HEIGHT = 1_506
const WECHAT_SCREENSHOT_WIDTH = 780
const FORCE_SCREENSHOT_TIMEOUT_ONCE_ENV = 'WEAPP_VITE_COMPONENT_FORCE_SCREENSHOT_TIMEOUT_ONCE'

function resolveScreenshotSettleMs() {
  const configured = Number(process.env.WEAPP_VITE_COMPONENT_SCREENSHOT_SETTLE_MS)
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_SCREENSHOT_SETTLE_MS
}

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
  runtimeModeEnv?: string
  visualComponents?: readonly string[]
  devtoolsEngineBuildFallbackSettleMs?: number
  devtoolsRefreshProjectAfterConnect?: boolean
  devtoolsScreenshotSessionLimit?: number
  devtoolsWarmupScenarioRoute?: boolean
  expectedCount: number
  ignoredRuntimeErrorPatterns?: readonly RegExp[]
  methodReadinessFastPath?: boolean
  outputRoot: string
  progressLabel: string
  sessionReadyRoute?: string
  sessionReadySelector?: string
  screenshotSettleMs?: number
  screenshotSettleOverrides?: Readonly<Record<string, number>>
  scenarios: readonly ComponentScenarioLike[]
  suiteName: string
  testTimeout?: number
  updateBaselinesEnv: string
}

async function waitForRenderedSelector(page: any, selector: string, label: string) {
  if (typeof page?.waitForRendered === 'function') {
    await page.waitForRendered({ selector, timeout: PAGE_READY_TIMEOUT })
    return
  }
  const startedAt = Date.now()
  while (Date.now() - startedAt <= PAGE_READY_TIMEOUT) {
    if (await page?.$(selector)) {
      return
    }
    await page.waitFor(220)
  }
  throw new Error(`${label}: 等待 ${selector} 渲染超时`)
}

export function defineComponentLibraryRuntimeSuite(options: ComponentLibraryRuntimeSuiteOptions) {
  const runtimeProvider = resolveRuntimeProviderName()
  const appRoot = path.join(ROOT, options.appRoot)
  const distRoot = path.join(appRoot, 'dist')
  const baselineRoot = path.join(ROOT, options.baselineRoot)
  const outputRoot = path.join(ROOT, options.outputRoot)
  const updateBaselines = process.env[options.updateBaselinesEnv] === '1'
  const configuredScreenshotSettleMs = options.screenshotSettleMs ?? resolveScreenshotSettleMs()
  const sessionReadyRoute = options.sessionReadyRoute ?? DEFAULT_SESSION_READY_ROUTE
  const sessionReadySelector = options.sessionReadySelector ?? DEFAULT_SESSION_READY_SELECTOR
  const screenshotSettleMs = Number.isFinite(configuredScreenshotSettleMs)
    ? Math.max(0, Math.trunc(configuredScreenshotSettleMs))
    : resolveScreenshotSettleMs()
  const resolveScenarioScreenshotSettleMs = (component: string) => {
    const override = options.screenshotSettleOverrides?.[component]
    return typeof override === 'number' && Number.isFinite(override)
      ? Math.max(0, Math.trunc(override))
      : screenshotSettleMs
  }
  const configuredSessionLimit = options.devtoolsScreenshotSessionLimit
    ?? DEVTOOLS_SCREENSHOT_SESSION_LIMIT
  const devtoolsScreenshotSessionLimit = Number.isFinite(configuredSessionLimit)
    ? Math.max(1, Math.trunc(configuredSessionLimit))
    : DEVTOOLS_SCREENSHOT_SESSION_LIMIT
  const reportTimings = process.env.WEAPP_VITE_COMPONENT_TIMINGS === '1'
  const forceScreenshotTimeoutOnce = process.env[FORCE_SCREENSHOT_TIMEOUT_ONCE_ENV] === '1'
  const componentFilter = new Set(
    (process.env[options.componentFilterEnv] ?? '')
      .split(',')
      .map(component => component.trim())
      .filter(Boolean),
  )
  const runtimeMode = resolveComponentLibraryRuntimeMode(
    process.env[options.runtimeModeEnv ?? 'WEAPP_VITE_COMPONENT_LIBRARY_MODE'],
  )
  const modeScenarios = selectComponentLibraryScenarios(
    options.scenarios,
    runtimeMode,
    options.visualComponents,
  )
  const scenarios = componentFilter.size > 0
    ? modeScenarios.filter(scenario => componentFilter.has(scenario.component))
    : modeScenarios
  const reportProgress = (message: string) => {
    process.stderr.write(`[${options.progressLabel}][${runtimeProvider}] ${message}\n`)
  }
  const shouldIgnoreRuntimeError = (error: string) => {
    return options.ignoredRuntimeErrorPatterns?.some(pattern => pattern.test(error)) === true
  }
  let wechatSystemInfo: Record<string, unknown> | undefined
  let forcedScreenshotTimeout = false
  let warmupScenarioPage: any
  let warmupScenarioRoute = ''

  async function cleanupWechatScreenshotArtifacts(label: string) {
    const result = await cleanupDevtoolsScreenshotArtifacts()
    if (result.files > 0) {
      reportProgress(`${label} screenshot-temp files=${result.files} bytes=${result.bytes}`)
    }
  }

  async function captureWechatScreenshot(miniProgram: any, component: string) {
    const baselinePath = path.join(baselineRoot, `${component}.png`)
    const currentPath = path.join(outputRoot, `${component}.current.png`)
    const diffPath = path.join(outputRoot, `${component}.diff.png`)
    let screenshot: Buffer | undefined
    let screenshotError: unknown
    const captureStartedAt = Date.now()
    try {
      const shouldForceTimeout = forceScreenshotTimeoutOnce && !forcedScreenshotTimeout
      forcedScreenshotTimeout ||= shouldForceTimeout
      if (shouldForceTimeout) {
        reportProgress(`force-protocol-timeout ${component}`)
      }
      const rawScreenshot = await miniProgram.screenshot({ timeout: shouldForceTimeout ? 1 : 15_000 })
      const capturedAt = Date.now()
      const deviceScreenshot = typeof rawScreenshot === 'string'
        ? Buffer.from(rawScreenshot, 'base64')
        : Buffer.from(rawScreenshot)
      const systemInfo = wechatSystemInfo ?? await miniProgram.systemInfo()
      wechatSystemInfo = systemInfo
      const systemInfoReadyAt = Date.now()
      screenshot = await normalizeWechatViewportScreenshot({
        screenshot: deviceScreenshot,
        systemInfo,
        targetHeight: WECHAT_SCREENSHOT_HEIGHT,
        targetWidth: WECHAT_SCREENSHOT_WIDTH,
      })
      const normalizedAt = Date.now()
      assertNonBlankPng(screenshot, `wechat/${component}`)
      if (reportTimings) {
        reportProgress(`capture ${component} protocol=${capturedAt - captureStartedAt}ms systemInfo=${systemInfoReadyAt - capturedAt}ms normalize=${normalizedAt - systemInfoReadyAt}ms`)
      }
    }
    catch (error) {
      screenshotError = error
    }
    if (!screenshot || screenshotError) {
      throw screenshotError ?? new Error(`wechat/${component}: 截图未返回有效图像`)
    }
    if (updateBaselines) {
      await fs.mkdir(path.dirname(baselinePath), { recursive: true })
      await fs.writeFile(baselinePath, screenshot)
      return
    }
    const compareStartedAt = Date.now()
    const result = await comparePngWithBaseline({
      baselinePath,
      currentPngBuffer: screenshot,
      threshold: 0.18,
    }).catch(async (error) => {
      await fs.mkdir(path.dirname(currentPath), { recursive: true })
      await fs.writeFile(currentPath, screenshot)
      throw error
    })
    if (reportTimings) {
      reportProgress(`compare ${component} pixels=${Date.now() - compareStartedAt}ms diffRatio=${result.diffRatio}`)
    }
    if (result.diffRatio > 0.03) {
      await fs.mkdir(path.dirname(currentPath), { recursive: true })
      await comparePngWithBaseline({
        baselinePath,
        currentOutputPath: currentPath,
        currentPngBuffer: screenshot,
        diffOutputPath: diffPath,
        threshold: 0.18,
      })
      throw new Error(`wechat/${component}: diffRatio=${result.diffRatio}`)
    }
  }

  describe(`${options.suiteName} [${runtimeProvider}]`, { concurrent: false }, () => {
    let miniProgram: any
    let runtimeErrorCollector: ReturnType<typeof attachRuntimeErrorCollector>

    async function launchRuntimeSession(label: string, scenario?: ComponentScenarioLike) {
      reportProgress(`${label} launch`)
      const shouldWarmupScenario = runtimeProvider === 'devtools'
        && options.devtoolsWarmupScenarioRoute === true
        && scenario != null
      const warmupRoute = shouldWarmupScenario
        ? scenario.route
        : sessionReadyRoute
      const warmupRootSelectors = shouldWarmupScenario
        ? [SCENARIO_READY_SELECTOR]
        : [sessionReadySelector]
      const devtoolsLaunchOptions = runtimeProvider === 'devtools'
        ? {
            ...(options.devtoolsEngineBuildFallbackSettleMs == null
              ? {}
              : { engineBuildFallbackSettleMs: options.devtoolsEngineBuildFallbackSettleMs }),
            ...(options.devtoolsRefreshProjectAfterConnect == null
              ? {}
              : { refreshProjectAfterConnect: options.devtoolsRefreshProjectAfterConnect }),
          }
        : {}
      miniProgram = await launchAutomator({
        launchMode: 'bridge',
        projectPath: appRoot,
        projectConfig: {
          setting: {
            useIsolateContext: false,
            useMultiFrameRuntime: false,
          },
        },
        skipRelaunchPageRootCheck: true,
        retryWarmupTimeout: true,
        ...devtoolsLaunchOptions,
        timeout: 120_000,
        warmupRootSelectors,
        warmupRoute,
      })
      wechatSystemInfo = undefined
      warmupScenarioPage = shouldWarmupScenario
        ? await miniProgram.currentPage({
            retries: 2,
            timeout: 5_000,
          }).catch(() => undefined)
        : undefined
      warmupScenarioRoute = warmupScenarioPage ? warmupRoute : ''
      resetAutomatorRuntimeLogs(miniProgram)
      runtimeErrorCollector = attachRuntimeErrorCollector(miniProgram)
      reportProgress(`${label} ready`)
    }

    async function closeRuntimeSession(label: string) {
      reportProgress(`${label} close`)
      runtimeErrorCollector?.dispose()
      await miniProgram?.close?.()
      miniProgram = undefined
      warmupScenarioPage = undefined
      warmupScenarioRoute = ''
      if (runtimeProvider === 'devtools') {
        await cleanupResidualIdeProcesses()
        await cleanupWechatScreenshotArtifacts(label)
      }
      reportProgress(`${label} closed`)
    }

    beforeAll(async () => {
      expect(options.scenarios).toHaveLength(options.expectedCount)
      await cleanupResidualIdeProcesses()
      if (runtimeProvider === 'devtools') {
        await cleanDevtoolsCache('all', { cwd: appRoot })
        await cleanupResidualIdeProcesses()
        await cleanupWechatScreenshotArtifacts('setup')
      }
      reportProgress('build')
      await fs.rm(outputRoot, { recursive: true, force: true })
      await fs.rm(distRoot, { recursive: true, force: true })
      await runWeappViteBuildWithLogCapture({
        cliPath: CLI_PATH,
        projectRoot: appRoot,
        platform: 'weapp',
        skipNpm: true,
        label: `${options.progressLabel}:${runtimeProvider}`,
      })
      await launchRuntimeSession('initial', scenarios[0])
    }, SUITE_SETUP_TIMEOUT)

    afterAll(async () => {
      await closeRuntimeSession('final')
    }, 60_000)

    it(`${runtimeMode} 模式逐页完成 ${scenarios.length} 个组件的渲染、交互与状态断言`, { timeout: options.testTimeout ?? 1_200_000 }, async () => {
      const failures: string[] = []
      for (const [index, scenario] of scenarios.entries()) {
        // 长时间连续截图会让 DevTools renderer 与协议队列逐步失稳；
        // 视觉套件定期轮换会话，但继续复用同一次构建并保留逐页真实截图。
        if (
          runtimeProvider === 'devtools'
          && shouldRotateComponentLibrarySession(runtimeMode, index, devtoolsScreenshotSessionLimit)
        ) {
          await closeRuntimeSession(`rotate-${index}`)
          await launchRuntimeSession(`rotate-${index}`, scenario)
        }
        reportProgress(`${index + 1}/${scenarios.length} ${scenario.component}`)
        const scenarioStartedAt = Date.now()
        let relaunchedAt = scenarioStartedAt
        let readyAt = scenarioStartedAt
        let assertedAt = scenarioStartedAt
        let settledAt = scenarioStartedAt
        let usedReadinessFallback = false
        let scenarioFailures: string[] = []
        let scenarioRuntimeErrors: string[] = []
        let scenarioError: unknown
        const maxAttempts = runtimeProvider === 'devtools'
          ? DEVTOOLS_SCENARIO_ATTEMPTS
          : 1

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const attemptFailures: string[] = []
          const runtimeErrorMarker = runtimeErrorCollector.mark()
          try {
            let page = warmupScenarioRoute === scenario.route && warmupScenarioPage
              ? warmupScenarioPage
              : await miniProgram.reLaunch(scenario.route)
            warmupScenarioPage = undefined
            warmupScenarioRoute = ''
            relaunchedAt = Date.now()
            readyAt = relaunchedAt
            assertedAt = relaunchedAt
            settledAt = relaunchedAt
            if (!page) {
              throw new Error('reLaunch 未返回页面')
            }
            let result: PageScenarioResult | undefined
            if (options.methodReadinessFastPath) {
              const fastMethodStartedAt = Date.now()
              try {
                result = await page.callMethodWithOptions('runE2E', {
                  routeOnly: true,
                }) as PageScenarioResult
                const fastMethodDuration = Date.now() - fastMethodStartedAt
                if (fastMethodDuration < FAST_METHOD_ROOT_CONFIRM_THRESHOLD_MS) {
                  await waitForRenderedSelector(page, '#e2e-root', scenario.component)
                }
                readyAt = Date.now()
              }
              catch {
              }
            }
            if (!options.methodReadinessFastPath || (
              result?.component !== scenario.component
              || !result.rendered
              || !result.ok
              || !result.state?.startsWith(scenario.expectedState)
            )) {
              usedReadinessFallback = options.methodReadinessFastPath === true
              if (usedReadinessFallback) {
                page = await miniProgram.reLaunch(scenario.route)
                if (!page) {
                  throw new Error('fallback reLaunch 未返回页面')
                }
              }
              await waitForRenderedSelector(page, '#e2e-root', scenario.component)
              readyAt = Date.now()
              result = await page.callMethodWithOptions('runE2E', {
                routeOnly: true,
              }) as PageScenarioResult
            }
            assertedAt = Date.now()
            if (result.component !== scenario.component) {
              attemptFailures.push(`${scenario.component}: bridge component=${result.component ?? '<missing>'}`)
            }
            if (!result.rendered || !result.ok || !result.state?.startsWith(scenario.expectedState)) {
              attemptFailures.push(`${scenario.component}: expected=${scenario.expectedState}, result=${JSON.stringify(result)}`)
            }
            await page.waitFor(resolveScenarioScreenshotSettleMs(scenario.component))
            settledAt = Date.now()
            if (runtimeProvider === 'devtools' && shouldCaptureComponentLibraryScreenshot(runtimeMode)) {
              await captureWechatScreenshot(miniProgram, scenario.component)
            }
            scenarioFailures = attemptFailures
            scenarioRuntimeErrors = runtimeErrorCollector
              .getSince(runtimeErrorMarker)
              .filter((error) => {
                const ignored = shouldIgnoreRuntimeError(error)
                if (ignored) {
                  reportProgress(`ignored-runtime-error ${scenario.component} ${error}`)
                }
                return !ignored
              })
            scenarioError = undefined
            break
          }
          catch (error) {
            scenarioError = error
            const reason = error instanceof Error ? error.message : String(error)
            reportProgress(`attempt-failed ${scenario.component} attempt=${attempt}/${maxAttempts} reason=${reason}`)
            if (attempt >= maxAttempts || !shouldRecoverComponentLibrarySession(error)) {
              break
            }
            await closeRuntimeSession(`recover-${scenario.component}`)
            await launchRuntimeSession(`recover-${scenario.component}`, scenario)
          }
        }

        if (scenarioError) {
          failures.push(`${scenario.component}: ${scenarioError instanceof Error ? scenarioError.message : String(scenarioError)}`)
        }
        failures.push(...scenarioFailures)
        for (const error of scenarioRuntimeErrors) {
          failures.push(`${scenario.component}: runtime ${scenario.route}: ${error}`)
        }
        if (reportTimings) {
          const completedAt = Date.now()
          const safeReadyAt = Math.max(readyAt, relaunchedAt)
          const safeAssertedAt = Math.max(assertedAt, safeReadyAt)
          const safeSettledAt = Math.max(settledAt, safeAssertedAt)
          reportProgress(`timing ${scenario.component} reLaunch=${relaunchedAt - scenarioStartedAt}ms ready=${safeReadyAt - relaunchedAt}ms run=${safeAssertedAt - safeReadyAt}ms settle=${safeSettledAt - safeAssertedAt}ms screenshot=${completedAt - safeSettledAt}ms total=${completedAt - scenarioStartedAt}ms fallback=${usedReadinessFallback}`)
        }
      }
      reportProgress(`assert failures=${failures.length}`)
      expect(scenarios.length).toBeGreaterThan(0)
      expect(failures, failures.join('\n')).toEqual([])
      reportProgress('asserted')
    })
  })
}
