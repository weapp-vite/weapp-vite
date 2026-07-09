/* eslint-disable e18e/ban-dependencies -- IDE e2e 测试需要 execa 驱动准备脚本。 */
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { runtimeBaseRoutes } from '../chunk-modes.matrix'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import {
  cleanDevtoolsCache,
  cleanupResidualIdeProcesses,
} from '../utils/ide-devtools-cleanup'
import { assertNoRecentDevtoolsSimulatorBootIssues } from '../utils/ide-devtools-logs'

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const PREPARE_SCRIPT_PATH = path.resolve(import.meta.dirname, '../../scripts/chunk-modes-project.mjs')
const DIST_MATRIX_ROOT = path.join(APP_ROOT, 'dist-matrix')
const LEADING_SLASHES_RE = /^\/+/
const CHUNK_MODES_RUNTIME_CASE_TIMEOUT = 4 * 60_000
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_LAUNCH_MODE_BRIDGE = 'bridge'
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const ROUTE_RECOVERY_ATTEMPTS = 3
const ROUTE_READINESS_TIMEOUT = 6_000
const ROUTE_RELAUNCH_ATTEMPTS = 2
const ROUTE_RUN_E2E_TIMEOUT = 15_000
const ROUTE_RECOVERY_ERROR_PATTERNS = [
  /Timeout in raw reLaunch/i,
  /simulator not found/i,
  /模拟器启动失败/,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
  /subPackages[\s\S]{0,80}undefined/i,
  /Target closed/i,
  /Execution context was destroyed/i,
  /WebSocket is not open/i,
  /not connected/i,
  /App\.callFunction/i,
  /unexpected current frame status timedout/i,
  /route method _runE2E not found/i,
  /route _runE2E .* timed out after/i,
]
const chunkModesIdeSmokeRoutes = [runtimeBaseRoutes[0]!]

interface RuntimeRouteCase {
  route: string
  readyText: string
  expectedTokens: string[]
}

export interface RuntimeMatrixCase {
  id: string
  env: Record<string, string>
  routes: RuntimeRouteCase[]
}

let sharedMiniProgram: any = null
let sharedLaunchInfraUnavailableMessage: string | null = null

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withLocalTimeout<T>(task: Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value == null) {
    delete process.env[key]
  }
  else {
    process.env[key] = value
  }
}

function isRecoverableRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return ROUTE_RECOVERY_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

function isSessionFatalRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Timeout in raw reLaunch/i.test(message)
    || /Timed out waiting page root after reLaunch/i.test(message)
    || /reLaunch returned empty page/i.test(message)
    || /simulator not found/i.test(message)
    || /模拟器启动失败/.test(message)
    || /subPackages[\s\S]{0,80}undefined/i.test(message)
    || /Target closed/i.test(message)
    || /WebSocket is not open/i.test(message)
    || /not connected/i.test(message)
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASHES_RE, '')
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage({
        appFunctionFallback: false,
        retries: 1,
        timeout: 2_500,
      })
      if (normalizeRoutePath(page?.path ?? '') === normalizedExpectedPath) {
        return page
      }
    }
    catch {
      // 页面切换时 currentPage 可能短暂失败，继续轮询。
    }
    await delay(220)
  }
  return null
}

export async function relaunchPage(
  miniProgram: any,
  route: string,
  _readyText?: string,
  timeoutMs = 15_000,
  options: { currentPageOnly?: boolean, forceRelaunch?: boolean } = {},
) {
  const routeReadinessTimeout = Math.min(timeoutMs, ROUTE_READINESS_TIMEOUT)
  if (!options.forceRelaunch) {
    const bootedPage = await waitForCurrentPagePath(miniProgram, route, routeReadinessTimeout)
    if (bootedPage) {
      return bootedPage
    }
    if (options.currentPageOnly) {
      return null
    }
  }
  for (let attempt = 0; attempt < ROUTE_RELAUNCH_ATTEMPTS; attempt += 1) {
    let page: any = null
    try {
      page = await miniProgram.reLaunch(route)
    }
    catch (error) {
      if (isSessionFatalRouteError(error)) {
        return null
      }
      await delay(280)
      continue
    }
    if (!page) {
      await delay(220)
      continue
    }

    const currentPage = await waitForCurrentPagePath(miniProgram, route, routeReadinessTimeout)
    const targetPage = currentPage ?? page
    if (normalizeRoutePath(targetPage?.path ?? '') === normalizeRoutePath(route)) {
      return targetPage
    }
    await delay(220)
  }

  return null
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await miniProgram.close().catch(() => {})
}

async function prepareScenarioProject(runtimeCase: RuntimeMatrixCase) {
  const scenarioRoot = path.join(DIST_MATRIX_ROOT, runtimeCase.id)
  await closeSharedMiniProgram()
  await cleanupResidualIdeProcesses()
  await fs.remove(scenarioRoot)

  const result = await execa('node', [
    PREPARE_SCRIPT_PATH,
    '--scenario',
    runtimeCase.id,
  ], {
    cwd: APP_ROOT,
    reject: false,
    all: true,
  })

  if ((result.exitCode ?? 1) !== 0) {
    throw new Error(`[${runtimeCase.id}] prepare scenario failed\n${result.all ?? ''}`)
  }

  // 每个 chunk 拓扑使用独立项目路径，避免 DevTools 复用旧 simulator appConfig 缓存。
  return scenarioRoot
}

async function getSharedMiniProgram(
  projectPath: string,
  ctx?: { skip: (message?: string) => void },
  options: { skipWarmup?: boolean } = {},
) {
  if (sharedLaunchInfraUnavailableMessage) {
    ctx?.skip(sharedLaunchInfraUnavailableMessage)
    throw new Error(sharedLaunchInfraUnavailableMessage)
  }

  if (!sharedMiniProgram) {
    const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
    const previousLaunchMode = process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    try {
      if (!previousLaunchMode) {
        process.env[AUTOMATOR_LAUNCH_MODE_ENV] = AUTOMATOR_LAUNCH_MODE_BRIDGE
      }
      if (options.skipWarmup) {
        process.env[AUTOMATOR_SKIP_WARMUP_ENV] = '1'
      }
      sharedMiniProgram = await launchAutomator({
        projectPath,
        timeout: 60_000,
        trustProject: true,
      })
      await delay(1200)
    }
    catch (error) {
      if (ctx && isDevtoolsHttpPortError(error)) {
        sharedLaunchInfraUnavailableMessage = 'WeChat DevTools 基础设施不可用，跳过 chunk-modes IDE 自动化用例。'
        ctx.skip(sharedLaunchInfraUnavailableMessage)
      }
      throw error
    }
    finally {
      restoreEnvValue(AUTOMATOR_LAUNCH_MODE_ENV, previousLaunchMode)
      restoreEnvValue(AUTOMATOR_SKIP_WARMUP_ENV, previousSkipWarmup)
    }
  }

  return sharedMiniProgram
}

async function resetDevtoolsProjectState(projectPath: string) {
  await closeSharedMiniProgram()
  // chunk mode 会连续切换共享 chunk 拓扑；只清 compile cache 时，DevTools 仍可能沿用旧项目索引启动模拟器。
  await cleanDevtoolsCache('all', { cwd: projectPath }).catch(() => {})
  await cleanupResidualIdeProcesses()
}

async function recoverRouteLaunch(projectPath: string, runtimeCase: RuntimeMatrixCase, route: string, reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason)
  process.stdout.write(`[warn] [chunk-modes:route-recover] scenario=${runtimeCase.id} route=${route} reason=${message.slice(0, 240)}\n`)
  await resetDevtoolsProjectState(projectPath)
}

async function callRouteRunE2E(miniProgram: any, route: string) {
  const result = await withLocalTimeout(miniProgram.evaluateWithOptions(`async function (route) {
    function normalizeRoute(value) {
      return String(value || '').replace(/^\\/+/, '').replace(/\\/+$/g, '');
    }
    var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    var expectedRoute = normalizeRoute(route);
    for (var index = pages.length - 1; index >= 0; index -= 1) {
      var page = pages[index];
      var pageRoute = normalizeRoute(page && (page.path || page.route || page.__route__));
      if (pageRoute === expectedRoute && typeof page._runE2E === 'function') {
        return {
          __weappViteRouteMethodFound: true,
          value: await page._runE2E()
        };
      }
    }
    return {
      __weappViteRouteMethodFound: false,
      routes: pages.map(function (page) {
        return normalizeRoute(page && (page.path || page.route || page.__route__));
      })
    };
  }`, {
    timeout: 12_000,
  }, route), ROUTE_RUN_E2E_TIMEOUT, `route _runE2E ${route}`)
  if (result && typeof result === 'object' && result.__weappViteRouteMethodFound === true) {
    return result.value
  }
  const routes = Array.isArray(result?.routes) ? result.routes.join(',') : '<unknown>'
  throw new Error(`route method _runE2E not found for ${route}; routes=${routes}`)
}

function assertRouteRunE2EResult(runtimeCase: RuntimeMatrixCase, routeCase: RuntimeRouteCase, result: any) {
  expect(result?.ok).toBe(true)
  expect(result?.scenarioId).toBe(runtimeCase.id)
  expect(result?.tokens).toEqual(expect.arrayContaining(routeCase.expectedTokens))
}

async function runRouteCaseWithRecovery(
  runtimeCase: RuntimeMatrixCase,
  routeCase: RuntimeRouteCase,
  projectPath: string,
  ctx: { skip: (message?: string) => void },
  launchOptions: { skipWarmup?: boolean },
) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= ROUTE_RECOVERY_ATTEMPTS; attempt += 1) {
    const attemptStartedAt = Date.now()
    const miniProgram = await getSharedMiniProgram(projectPath, ctx, launchOptions)
    const isInitialRoute = routeCase.route === runtimeCase.routes[0]?.route
    let page: any = null
    try {
      if (isInitialRoute) {
        try {
          const result = await callRouteRunE2E(miniProgram, routeCase.route)
          assertRouteRunE2EResult(runtimeCase, routeCase, result)
          return
        }
        catch (error) {
          if (!isRecoverableRouteError(error)) {
            throw error
          }
          lastError = error
        }
      }
      if (!isInitialRoute || !lastError) {
        page = await relaunchPage(miniProgram, routeCase.route, runtimeCase.id, isInitialRoute ? 45_000 : 15_000, {
          currentPageOnly: isInitialRoute,
        })
      }
      assertNoRecentDevtoolsSimulatorBootIssues({
        label: `${runtimeCase.id}:${routeCase.route}`,
        sinceMs: attemptStartedAt,
      })
    }
    catch (error) {
      if (!isRecoverableRouteError(error)) {
        throw error
      }
      lastError = error
    }
    if (!page) {
      lastError ??= new Error(`[${runtimeCase.id}] failed to launch route: ${routeCase.route}`)
    }
    else {
      try {
        const result = await callRouteRunE2E(miniProgram, routeCase.route)
        assertRouteRunE2EResult(runtimeCase, routeCase, result)
        return
      }
      catch (error) {
        if (!isRecoverableRouteError(error)) {
          throw error
        }
        lastError = error
      }
    }

    if (attempt >= ROUTE_RECOVERY_ATTEMPTS) {
      break
    }
    await recoverRouteLaunch(projectPath, runtimeCase, routeCase.route, lastError)
  }

  throw lastError
}

export function createChunkModesRuntimeSuite(suiteName: string, runtimeCases: RuntimeMatrixCase[]) {
  describe.sequential(suiteName, () => {
    afterAll(async () => {
      await closeSharedMiniProgram()
    })

    for (const runtimeCase of runtimeCases) {
      it(`runs without runtime errors in devtools for ${runtimeCase.id}`, async (ctx) => {
        const projectPath = await prepareScenarioProject(runtimeCase)
        await resetDevtoolsProjectState(projectPath)

        const launchOptions = {
          skipWarmup: true,
        }
        await getSharedMiniProgram(projectPath, ctx, launchOptions)

        for (const routeCase of runtimeCase.routes) {
          await runRouteCaseWithRecovery(runtimeCase, routeCase, projectPath, ctx, launchOptions)
        }
      }, CHUNK_MODES_RUNTIME_CASE_TIMEOUT)
    }
  })
}

function withRoutes(
  cases: Array<{ id: string, env: Record<string, string> }>,
  routes: RuntimeRouteCase[],
): RuntimeMatrixCase[] {
  return cases.map(item => ({
    ...item,
    routes,
  }))
}

export function withBaseRoutes(cases: Array<{ id: string, env: Record<string, string> }>): RuntimeMatrixCase[] {
  return withRoutes(cases, runtimeBaseRoutes)
}

export function withIdeSmokeRoutes(cases: Array<{ id: string, env: Record<string, string> }>): RuntimeMatrixCase[] {
  return withRoutes(cases, chunkModesIdeSmokeRoutes)
}
