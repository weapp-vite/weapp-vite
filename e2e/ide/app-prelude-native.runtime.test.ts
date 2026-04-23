import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { isDevtoolsHttpPortError, launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { relaunchPage, waitForCurrentPagePath } from './github-issues.runtime.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-prelude-native')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const APP_PRELUDE_IDE_LAUNCH_TIMEOUT = 180_000

async function delay(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

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
    await runBuild(
      mode === 'inline' ? 'inline' : undefined,
      { requestRuntime: mode === 'default-request-runtime' },
    )
    sharedBuildPreparedModes.add(mode)
  }

  try {
    return await launchAutomator({
      projectPath: APP_ROOT,
      timeout: APP_PRELUDE_IDE_LAUNCH_TIMEOUT,
    })
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

async function collectPreludeLogs(
  ctx: { skip: (message?: string) => void },
  route: string,
  mode: 'default' | 'inline' | 'default-request-runtime',
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const miniProgram = await launchFreshMiniProgram(ctx, mode)
    try {
      const page = await waitForCurrentPagePath(miniProgram, route, 30_000)
        ?? await relaunchPage(miniProgram, route, undefined, 30_000)
      if (!page) {
        throw new Error(`Failed to launch ${route}`)
      }
      await page.waitFor(500)
      return await miniProgram.evaluate(() => {
        return getApp<{ getPreludeLog?: () => string[] }>()?.getPreludeLog?.() ?? []
      })
    }
    catch (error) {
      lastError = error
      if (attempt < 3) {
        await delay(600)
      }
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  }

  throw lastError
}

async function collectRequestRuntimeState(
  ctx: { skip: (message?: string) => void },
  route: string,
  mode: 'default-request-runtime',
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const miniProgram = await launchFreshMiniProgram(ctx, mode)
    try {
      const page = await waitForCurrentPagePath(miniProgram, route, 30_000)
        ?? await relaunchPage(miniProgram, route, undefined, 30_000)
      if (!page) {
        throw new Error(`Failed to launch ${route}`)
      }
      await page.waitFor(500)
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
    catch (error) {
      lastError = error
      if (attempt < 3) {
        await delay(600)
      }
    }
    finally {
      await miniProgram.close().catch(() => {})
    }
  }

  throw lastError
}

describe.sequential('e2e app: app-prelude-native runtime', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('executes inline app prelude once even after relaunching main and subpackage pages', async (ctx) => {
    const mainLogs = await collectPreludeLogs(ctx, '/pages/index/index', 'inline')
    const normalLogs = await collectPreludeLogs(ctx, '/subpackages/normal/pages/entry/index', 'inline')
    const independentLogs = await collectPreludeLogs(ctx, '/subpackages/independent/pages/entry/index', 'inline')

    expect(mainLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(normalLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(independentLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
  })

  it('keeps one prelude side effect per package scope under default require mode', async (ctx) => {
    const mainLogs = await collectPreludeLogs(ctx, '/pages/index/index', 'default')
    const normalLogs = await collectPreludeLogs(ctx, '/subpackages/normal/pages/entry/index', 'default')
    const independentLogs = await collectPreludeLogs(ctx, '/subpackages/independent/pages/entry/index', 'default')

    expect(mainLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(normalLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
    expect(independentLogs).toEqual(['app.prelude.ts:/app.prelude.ts'])
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
