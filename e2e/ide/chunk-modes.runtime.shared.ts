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

const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/chunk-modes')
const PREPARE_SCRIPT_PATH = path.resolve(import.meta.dirname, '../../scripts/chunk-modes-project.mjs')
const DIST_MATRIX_ROOT = path.join(APP_ROOT, 'dist-matrix')
const LEADING_SLASHES_RE = /^\/+/
const AUTOMATOR_OVERLAY_RE = /\s*\.luna-dom-highlighter[\s\S]*$/
const CHUNK_MODES_RUNTIME_CASE_TIMEOUT = 4 * 60_000
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_LAUNCH_MODE_BRIDGE = 'bridge'
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const ROUTE_RECOVERY_ATTEMPTS = 2
const ROUTE_RECOVERY_ERROR_PATTERNS = [
  /simulator not found/i,
  /模拟器启动失败/,
  /cannot read propert(?:y|ies)\s+['"]subPackages['"]\s+of\s+undefined/i,
  /cannot read propert(?:y|ies)\s+\(reading\s+['"]subPackages['"]\)/i,
  /subPackages[\s\S]{0,80}undefined/i,
  /Target closed/i,
  /Execution context was destroyed/i,
  /WebSocket is not open/i,
  /not connected/i,
]

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

async function runWithTimeout<T>(factory: () => Promise<T>, timeoutMs: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  const task = Promise.resolve()
    .then(factory)
    .then((value) => {
      settled = true
      return value
    })
    .catch((error) => {
      settled = true
      throw error
    })

  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timeout in ${label} after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
    if (!settled) {
      void task.catch(() => {})
    }
  }
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(LEADING_SLASHES_RE, '')
}

function stripAutomatorOverlay(wxml: string) {
  return wxml.replace(AUTOMATOR_OVERLAY_RE, '')
}

async function readPageWxml(page: any) {
  const element = await page.$('page')
  if (!element) {
    throw new Error('Failed to find page element')
  }
  return stripAutomatorOverlay(await element.wxml())
}

async function waitForPageWxml(page: any, readyText?: string, timeoutMs = 15_000) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const wxml = await readPageWxml(page)
      const normalized = wxml.trim()
      if (readyText) {
        if (normalized.includes(readyText)) {
          return true
        }
      }
      else if (normalized && normalized !== '<text></text>') {
        return true
      }
    }
    catch {
      // 页面切换瞬态下 DOM 可能短暂不可读，继续轮询。
    }

    if (typeof page?.waitFor === 'function') {
      try {
        await page.waitFor(220)
        continue
      }
      catch {
        // page 对象短暂失效时退回普通 sleep。
      }
    }
    await delay(220)
  }
  return false
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage()
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

async function relaunchPage(miniProgram: any, route: string, readyText?: string, timeoutMs = 15_000) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let page: any = null
    try {
      page = await runWithTimeout(
        () => miniProgram.reLaunch(route),
        timeoutMs,
        `chunk-modes reLaunch ${route}#${attempt + 1}`,
      )
    }
    catch {
      await delay(280)
      continue
    }
    if (!page) {
      await delay(220)
      continue
    }

    const currentPage = await waitForCurrentPagePath(miniProgram, route, timeoutMs)
    const targetPage = currentPage ?? page
    const ready = await waitForPageWxml(targetPage, readyText, timeoutMs)
    if (ready) {
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

async function runRouteCaseWithRecovery(
  runtimeCase: RuntimeMatrixCase,
  routeCase: RuntimeRouteCase,
  projectPath: string,
  ctx: { skip: (message?: string) => void },
  launchOptions: { skipWarmup?: boolean },
) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= ROUTE_RECOVERY_ATTEMPTS; attempt += 1) {
    const miniProgram = await getSharedMiniProgram(projectPath, ctx, launchOptions)
    const page = await relaunchPage(miniProgram, routeCase.route, routeCase.readyText)
    if (!page) {
      lastError = new Error(`[${runtimeCase.id}] failed to launch route: ${routeCase.route}`)
    }
    else {
      try {
        const result = await page.callMethod('_runE2E')
        expect(result?.ok).toBe(true)
        expect(result?.tokens).toEqual(expect.arrayContaining(routeCase.expectedTokens))
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
          skipWarmup: !runtimeCase.id.startsWith('hoist-'),
        }
        await getSharedMiniProgram(projectPath, ctx, launchOptions)

        for (const routeCase of runtimeCase.routes) {
          await runRouteCaseWithRecovery(runtimeCase, routeCase, projectPath, ctx, launchOptions)
        }
      }, CHUNK_MODES_RUNTIME_CASE_TIMEOUT)
    }
  })
}

export function withBaseRoutes(cases: Array<{ id: string, env: Record<string, string> }>): RuntimeMatrixCase[] {
  return cases.map(item => ({
    ...item,
    routes: runtimeBaseRoutes,
  }))
}
