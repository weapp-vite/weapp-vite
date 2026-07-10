import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { attachRuntimeErrorCollector } from './runtimeErrors'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/plugin-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const PLUGIN_DIST_ROOT = path.join(APP_ROOT, 'dist-plugin')
const HOST_ROUTE = '/pages/index/index'

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

function shouldRetryAutomatorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Wait timed out after')
    || message.includes('Timeout in ')
    || message.includes('Execution context was destroyed')
    || message.includes('Target closed')
}

function isDevtoolsPageProtocolUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Timeout in relaunch plugin host page')
    || message.includes('Operation timed out after 1000ms')
    || message.includes('Operation timed out after 2000ms')
    || message.includes('Operation timed out after 3000ms')
    || message.includes('DevTools did not respond to protocol method App.getCurrentPage')
    || message.includes('DevTools did not respond to protocol method App.getPageStack')
    || message.includes('Connection closed, check if wechat web devTools is still running')
    || message.includes('WebSocket is not open')
    || message.includes('socket hang up')
    || message.includes('Target closed')
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runAutomatorOp<T>(
  label: string,
  factory: () => Promise<T>,
  options: { timeoutMs?: number, retries?: number, retryDelayMs?: number } = {},
) {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryDelayMs = 220,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await runWithTimeout(factory, timeoutMs, `${label}#${attempt}`)
    }
    catch (error) {
      lastError = error
      if (attempt < retries && shouldRetryAutomatorError(error)) {
        await delay(retryDelayMs)
        continue
      }
      throw error
    }
  }

  throw lastError
}

async function runBuild() {
  await cleanupResidualIdeProcesses()
  await cleanDevtoolsCache('all', { cwd: APP_ROOT }).catch(() => {})
  await fs.remove(DIST_ROOT)
  await fs.remove(PLUGIN_DIST_ROOT)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    label: 'ide:plugin-demo',
  })
}

let sharedMiniProgram: any = null
let sharedBuildPrepared = false

async function getSharedMiniProgram() {
  if (!sharedBuildPrepared) {
    await runBuild()
    sharedBuildPrepared = true
  }
  if (!sharedMiniProgram) {
    sharedMiniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      skipWarmup: true,
    })
  }
  return sharedMiniProgram
}

async function closeSharedMiniProgram() {
  if (!sharedMiniProgram) {
    return
  }
  const miniProgram = sharedMiniProgram
  sharedMiniProgram = null
  await runAutomatorOp('close mini program', () => miniProgram.close(), {
    timeoutMs: 12_000,
    retries: 2,
    retryDelayMs: 200,
  }).catch(() => {})
}

function normalizeRoutePath(routePath: string) {
  return routePath.replace(/^\/+/, '')
}

async function waitForCurrentPagePath(miniProgram: any, expectedPath: string, timeoutMs = 12_000) {
  const normalizedExpectedPath = normalizeRoutePath(expectedPath)
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    try {
      const page = await miniProgram.currentPage({ retries: 1, timeout: 5_000 })
      if (normalizeRoutePath(page?.path ?? '') === normalizedExpectedPath) {
        return page
      }
    }
    catch {
    }
    await delay(220)
  }
  return null
}

async function waitForRuntimeLog(
  collector: ReturnType<typeof attachRuntimeErrorCollector>,
  marker: number,
  expected: string,
  timeoutMs = 12_000,
) {
  const start = Date.now()
  let latest: string[] = []
  while (Date.now() - start <= timeoutMs) {
    latest = collector.getLogsSince(marker)
    if (latest.some(log => log.includes(expected))) {
      return latest
    }
    await delay(220)
  }
  throw new Error(`Timed out waiting runtime log ${expected}; latest=${latest.join(' | ') || '<missing>'}`)
}

async function resolveHostPage(miniProgram: any) {
  let page = await waitForCurrentPagePath(miniProgram, HOST_ROUTE, 12_000)
  if (!page) {
    try {
      page = await runWithTimeout(
        () => miniProgram.reLaunch(HOST_ROUTE),
        15_000,
        'relaunch plugin host page',
      )
    }
    catch (error) {
      if (!isDevtoolsPageProtocolUnavailable(error)) {
        throw error
      }
    }
    page = await waitForCurrentPagePath(miniProgram, HOST_ROUTE, 12_000) ?? page
  }
  try {
    if (!page) {
      page = await runWithTimeout(
        () => miniProgram.currentPage({ retries: 1, timeout: 3_000 }),
        4_000,
        'read plugin host current page',
      )
    }
  }
  catch (error) {
    if (isDevtoolsPageProtocolUnavailable(error)) {
      throw new Error('Plugin project page protocol unavailable', { cause: error })
    }
    throw error
  }

  if (!page) {
    throw new Error('Plugin project current page is missing')
  }
  if (normalizeRoutePath(page.path ?? '') !== 'pages/index/index') {
    throw new Error(`Plugin project current page is not host: ${page.path ?? '<none>'}`)
  }

  try {
    await page.waitForRendered({
      selector: '#plugin-host-ready',
      dataset: {
        featureCount: 4,
        pluginAnswer: 42,
        showcaseProgress: 78,
      },
      timeout: 12_000,
    })
  }
  catch (error) {
    if (isDevtoolsPageProtocolUnavailable(error)) {
      throw new Error('Plugin project page protocol unavailable', { cause: error })
    }
    throw error
  }
  return page
}

describe.sequential('plugin-demo runtime (ide)', () => {
  afterAll(async () => {
    await closeSharedMiniProgram()
  })

  it('loads host page, renders plugin public components, and opens plugin vue page without runtime errors', async () => {
    const miniProgram = await getSharedMiniProgram()
    const errorCollector = attachRuntimeErrorCollector(miniProgram)
    const marker = errorCollector.mark()

    try {
      async function runStep<T>(label: string, task: () => Promise<T>) {
        try {
          return await task()
        }
        catch (error) {
          const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          throw new Error(`[plugin-demo:${label}] ${reason}`)
        }
      }

      const page = await runStep('resolve-host', () => resolveHostPage(miniProgram))
      if (!page) {
        throw new Error('Failed to launch /pages/index/index')
      }

      await runStep('host-link-dom', () => page.waitForRendered({
        selector: '#plugin-vue-page-link',
        timeout: 12_000,
      }))

      await runStep('host-boost-showcase', () => page.callMethod('boostShowcase'))
      await runStep('host-progress-dom', () => page.waitForRendered({
        selector: '#plugin-host-ready',
        dataset: {
          showcaseProgress: 84,
        },
        timeout: 12_000,
      }))

      const vuePluginPage = await runStep(
        'host-open-vue-plugin',
        () => miniProgram.navigateTo('plugin://hello-plugin/hello-page'),
      )
      expect(normalizeRoutePath(vuePluginPage.path)).toMatch(
        /^(?:plugin-private:\/\/|__plugin__\/)wxb3d842a4a7e3440d\/pages\/hello-page\/index$/,
      )
      await runStep(
        'vue-plugin-ready-log',
        () => waitForRuntimeLog(
          errorCollector,
          marker,
          '[plugin-demo] vue-page-ready score=94 cards=4',
        ),
      )

      const runtimeErrors = await runStep('collect-runtime-errors', async () => errorCollector.getSince(marker))
      expect(runtimeErrors).toEqual([])
    }
    finally {
      errorCollector.dispose()
    }
  })
})
