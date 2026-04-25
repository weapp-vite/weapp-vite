import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { relaunchPage, waitForCurrentPagePath } from './github-issues.runtime.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const APP_PRELUDE_IDE_LAUNCH_TIMEOUT = 180_000
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'

async function runBuild(
  mode?: 'inline',
  options?: {
    requestRuntime?: boolean
  },
) {
  await fs.remove(DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: `ide:app-prelude-native:${mode ?? 'default'}`,
    skipNpm: true,
    env: {
      ...(mode ? { APP_PRELUDE_MODE: mode } : {}),
      ...(options?.requestRuntime ? { APP_PRELUDE_REQUEST_GLOBALS: '1' } : {}),
    },
  })
}

const sharedBuildPreparedModes = new Set<string>()

async function launchFreshMiniProgram(
  ctx: { skip: (message?: string) => void },
  mode: 'default' | 'inline' | 'default-request-runtime',
) {
  await cleanupResidualIdeProcesses()

  if (!sharedBuildPreparedModes.has(mode)) {
    // 同一路径下切换不同 appPrelude / request-runtime 构建拓扑时，
    // 微信开发者工具会复用旧的 compile cache，并在 app.json 尚未重建完成前
    // 先处理旧 chunk 的 onFileChange，留下过期模块图。
    await cleanDevtoolsCache('all', { cwd: APP_ROOT })
    await runBuild(
      mode === 'inline' ? 'inline' : undefined,
      { requestRuntime: mode === 'default-request-runtime' },
    )
    sharedBuildPreparedModes.add(mode)
  }

  try {
    const previousLaunchMode = process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
    try {
      delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
      delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
      return await launchAutomator({
        projectPath: APP_ROOT,
        timeout: APP_PRELUDE_IDE_LAUNCH_TIMEOUT,
      })
    }
    finally {
      if (previousLaunchMode == null) {
        delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
      }
      else {
        process.env[AUTOMATOR_LAUNCH_MODE_ENV] = previousLaunchMode
      }
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

async function ensureRoutePage(miniProgram: any, route: string) {
  const page = await waitForCurrentPagePath(miniProgram, route, 10_000)
    ?? await relaunchPage(miniProgram, route, undefined, 45_000)
  if (!page) {
    throw new Error(`Failed to launch ${route}`)
  }
  await page.waitFor(500)
  return page
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
      logsByRoute[route] = await miniProgram.evaluate(() => {
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
    return await miniProgram.evaluate(() => {
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
