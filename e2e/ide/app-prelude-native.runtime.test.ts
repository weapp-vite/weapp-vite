import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const SOURCE_APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
const SOURCE_NODE_MODULES = path.join(SOURCE_APP_ROOT, 'node_modules')
const PROJECTS_ROOT = path.resolve(import.meta.dirname, '../../.tmp/e2e-projects/app-prelude-native')
const APP_PRELUDE_IDE_LAUNCH_TIMEOUT = 180_000
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const CURRENT_PAGE_TIMEOUT = 3_000
const RELAUNCH_TIMEOUT = 12_000
const ROUTE_READY_TIMEOUT = 45_000
const PAGE_ROOT_TIMEOUT = 4_000
const EVALUATE_TIMEOUT = 5_000
const PROJECT_COPY_ENTRIES = [
  'package.json',
  'project.config.json',
  'project.private.config.json',
  'src',
  'tsconfig.json',
  'weapp-vite.config.ts',
] as const

type AppPreludeRuntimeMode = 'default' | 'inline' | 'default-request-runtime'

function normalizeRoutePath(route: string) {
  return route.replace(/^\/+/, '')
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function runWithTimeout<T>(
  factory: () => Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout?: () => Promise<void> | void,
) {
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
          void Promise.resolve(onTimeout?.()).catch(() => {})
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

async function runAutomatorOp<T>(
  label: string,
  factory: () => Promise<T>,
  options: { closeOnTimeout?: any, timeoutMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? CURRENT_PAGE_TIMEOUT
  return await runWithTimeout(
    factory,
    timeoutMs,
    label,
    async () => {
      await options.closeOnTimeout?.close?.().catch(() => {})
    },
  )
}

async function runBuild(
  projectRoot: string,
  mode?: 'inline',
  options?: {
    requestRuntime?: boolean
  },
) {
  await fs.remove(path.join(projectRoot, 'dist'))
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot,
    platform: 'weapp',
    cwd: projectRoot,
    label: `ide:app-prelude-native:${mode ?? 'default'}`,
    skipNpm: true,
    env: {
      ...(mode ? { APP_PRELUDE_MODE: mode } : {}),
      ...(options?.requestRuntime ? { APP_PRELUDE_REQUEST_GLOBALS: '1' } : {}),
    },
  })
}

function resolveProjectRoot(mode: AppPreludeRuntimeMode) {
  return path.join(PROJECTS_ROOT, mode)
}

async function prepareProjectRoot(projectRoot: string) {
  await fs.remove(projectRoot)
  await fs.ensureDir(projectRoot)
  await Promise.all(PROJECT_COPY_ENTRIES.map(async (entry) => {
    await fs.copy(path.join(SOURCE_APP_ROOT, entry), path.join(projectRoot, entry), {
      dereference: false,
    })
  }))
  if (await fs.pathExists(SOURCE_NODE_MODULES)) {
    await fs.symlink(SOURCE_NODE_MODULES, path.join(projectRoot, 'node_modules'), 'junction')
  }
}

const sharedBuildPreparedModes = new Set<AppPreludeRuntimeMode>()

async function launchFreshMiniProgram(
  ctx: { skip: (message?: string) => void },
  mode: AppPreludeRuntimeMode,
) {
  const projectRoot = resolveProjectRoot(mode)
  await cleanupResidualIdeProcesses()

  if (!sharedBuildPreparedModes.has(mode)) {
    // 每个构建拓扑使用独立项目路径，避免 DevTools 按项目路径复用旧 compile cache。
    await prepareProjectRoot(projectRoot)
    await cleanDevtoolsCache('all', { cwd: projectRoot })
    await runBuild(
      projectRoot,
      mode === 'inline' ? 'inline' : undefined,
      { requestRuntime: mode === 'default-request-runtime' },
    )
    sharedBuildPreparedModes.add(mode)
  }

  try {
    const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
    try {
      delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
      return await launchAutomator({
        projectPath: projectRoot,
        timeout: APP_PRELUDE_IDE_LAUNCH_TIMEOUT,
      })
    }
    finally {
      if (previousSkipWarmup == null) {
        delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
      }
      else {
        process.env[AUTOMATOR_SKIP_WARMUP_ENV] = previousSkipWarmup
      }
    }
  }
  catch (error) {
    if (isDevtoolsHttpPortError(error)) {
      ctx.skip('WeChat DevTools 服务端口未开启，跳过 app-prelude-native IDE 自动化用例。')
    }
    throw error
  }
}

async function closeSharedMiniProgram() {
  await cleanupResidualIdeProcesses()
}

async function waitForPageRoot(page: any, timeoutMs = PAGE_ROOT_TIMEOUT) {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const root = await runAutomatorOp(
        `read page root ${page?.path ?? '<unknown>'}`,
        () => page?.$('page'),
        { timeoutMs: Math.min(1_000, Math.max(1, timeoutMs - (Date.now() - start))) },
      )
      if (root) {
        return root
      }
    }
    catch {
    }
    await sleep(180)
  }
  return null
}

async function readCurrentRoutePage(miniProgram: any, route: string) {
  const page = await runAutomatorOp(
    `currentPage ${route}`,
    () => miniProgram.currentPage({ retries: 1, timeout: CURRENT_PAGE_TIMEOUT }),
    { timeoutMs: CURRENT_PAGE_TIMEOUT },
  )
  if (normalizeRoutePath(page?.path ?? '') !== normalizeRoutePath(route)) {
    return null
  }
  const root = await waitForPageRoot(page)
  return root ? page : null
}

async function waitForRoutePage(miniProgram: any, route: string) {
  const startedAt = Date.now()
  let lastError: unknown
  while (Date.now() - startedAt <= ROUTE_READY_TIMEOUT) {
    const currentPage = await readCurrentRoutePage(miniProgram, route).catch((error) => {
      lastError = error
      return null
    })
    if (currentPage) {
      process.stdout.write(`[app-prelude-native:route] ready route=${route} source=current-page\n`)
      return currentPage
    }

    try {
      process.stdout.write(`[app-prelude-native:route] relaunch route=${route}\n`)
      const page = await runAutomatorOp(
        `reLaunch ${route}`,
        () => miniProgram.reLaunch(route),
        {
          closeOnTimeout: miniProgram,
          timeoutMs: RELAUNCH_TIMEOUT,
        },
      )
      const root = await waitForPageRoot(page)
      if (root) {
        process.stdout.write(`[app-prelude-native:route] ready route=${route} source=relaunch\n`)
        return page
      }
      lastError = new Error(`Timed out waiting page root after reLaunch: ${route}`)
    }
    catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      process.stdout.write(`[app-prelude-native:route] relaunch-failed route=${route} message=${message}\n`)
      break
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to launch ${route}`)
}

async function ensureRoutePage(miniProgram: any, route: string) {
  process.stdout.write(`[app-prelude-native:route] ensure route=${route}\n`)
  const page = await waitForRoutePage(miniProgram, route)
  if (!page) {
    throw new Error(`Failed to launch ${route}`)
  }
  await runAutomatorOp(
    `settle route ${route}`,
    () => typeof page.waitFor === 'function' ? page.waitFor(500) : sleep(500),
    { timeoutMs: 2_000 },
  )
  return page
}

async function evaluateApp<T>(miniProgram: any, label: string, factory: () => T) {
  return await runAutomatorOp(
    `evaluate ${label}`,
    () => miniProgram.evaluate(factory),
    {
      closeOnTimeout: miniProgram,
      timeoutMs: EVALUATE_TIMEOUT,
    },
  )
}

async function collectPreludeLogsByRoute(
  ctx: { skip: (message?: string) => void },
  routes: string[],
  mode: 'default' | 'inline',
) {
  const miniProgram = await launchFreshMiniProgram(ctx, mode)
  try {
    const logsByRoute: Record<string, string[]> = {}
    for (const route of routes) {
      await ensureRoutePage(miniProgram, route)
      logsByRoute[route] = await evaluateApp(miniProgram, `prelude logs ${route}`, () => {
        return getApp<{ getPreludeLog?: () => string[] }>()?.getPreludeLog?.() ?? []
      })
    }
    return logsByRoute
  }
  finally {
    await miniProgram.close().catch(() => {})
  }
}

async function collectRequestRuntimeState(
  ctx: { skip: (message?: string) => void },
  route: string,
  mode: 'default-request-runtime',
) {
  const miniProgram = await launchFreshMiniProgram(ctx, mode)
  try {
    await ensureRoutePage(miniProgram, route)
    return await evaluateApp(miniProgram, `request runtime ${route}`, () => {
      return {
        fetch: typeof fetch,
        headers: typeof Headers,
        request: typeof Request,
        response: typeof Response,
        xmlHttpRequest: typeof XMLHttpRequest,
        webSocket: typeof WebSocket,
        url: typeof URL,
        urlSearchParams: typeof URLSearchParams,
        blob: typeof Blob,
        formData: typeof FormData,
      }
    })
  }
  finally {
    await miniProgram.close().catch(() => {})
  }
}

describe.sequential('e2e app: app-prelude-native runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('executes inline app prelude once even after relaunching main and subpackage pages', async (ctx) => {
    const logs = await collectPreludeLogsByRoute(ctx, [
      '/pages/index/index',
      '/subpackages/normal/pages/entry/index',
      '/subpackages/independent/pages/entry/index',
    ], 'inline')

    expect(logs['/pages/index/index']).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(logs['/subpackages/normal/pages/entry/index']).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(logs['/subpackages/independent/pages/entry/index']).toEqual(['app.prelude.ts:/app.prelude.ts'])
  })

  it('keeps one prelude side effect per package scope under default require mode', async (ctx) => {
    const logs = await collectPreludeLogsByRoute(ctx, [
      '/pages/index/index',
      '/subpackages/normal/pages/entry/index',
      '/subpackages/independent/pages/entry/index',
    ], 'default')

    expect(logs['/pages/index/index']).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(logs['/subpackages/normal/pages/entry/index']).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(logs['/subpackages/independent/pages/entry/index']).toEqual(['app.prelude.ts:/app.prelude.ts'])
  })

  it('installs request runtime globals through app.prelude.js under default require mode', async (ctx) => {
    const runtimeState = await collectRequestRuntimeState(ctx, '/pages/index/index', 'default-request-runtime')

    expect(runtimeState).toEqual({
      fetch: 'function',
      headers: 'function',
      request: 'function',
      response: 'function',
      xmlHttpRequest: 'undefined',
      webSocket: 'undefined',
      url: 'function',
      urlSearchParams: 'function',
      blob: 'function',
      formData: 'function',
    })
  })
})
