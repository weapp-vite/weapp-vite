import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { waitForCurrentPagePath } from './github-issues.runtime.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_NATIVE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-native')
const APP_WEVU_TS_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-ts')
const APP_WEVU_VUE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-vue')
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const INDEX_ROUTE = '/pages/index/index'
const INDEX_ROUTE_MARKER_SELECTOR = '#app-lifecycle-route'
const APP_HOOKS = [
  'onLaunch',
  'onShow',
  'onHide',
  'onError',
  'onPageNotFound',
  'onUnhandledRejection',
  'onThemeChange',
]

async function runBuild(root: string) {
  const distRoot = path.join(root, 'dist')
  await fs.remove(distRoot)
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: root,
    platform: 'weapp',
    skipNpm: true,
    label: `ide:app-lifecycle:${path.basename(root)}`,
  })
}

const sharedBuildPreparedRoots = new Set<string>()

async function launchFreshMiniProgram(root: string) {
  await cleanupResidualIdeProcesses()

  if (!sharedBuildPreparedRoots.has(root)) {
    // 同一路径首次打开前先清理 IDE 缓存，避免 DevTools 复用旧 app.json/compile 状态导致模拟器首启失败。
    await cleanDevtoolsCache('all', { cwd: root })
    await runBuild(root)
    sharedBuildPreparedRoots.add(root)
  }

  const previousSkipWarmup = process.env[AUTOMATOR_SKIP_WARMUP_ENV]
  try {
    delete process.env[AUTOMATOR_SKIP_WARMUP_ENV]
    return await launchAutomator({
      projectPath: root,
      retryWarmupTimeout: true,
      skipRelaunchPageRootCheck: true,
      warmupAllowRelaunch: true,
      warmupRootSelectors: [INDEX_ROUTE_MARKER_SELECTOR],
      warmupRoute: INDEX_ROUTE,
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

async function closeSharedMiniPrograms() {
  await cleanupResidualIdeProcesses()
}

async function waitForIndexPageRendered(miniProgram: any, timeoutMs = 30_000) {
  const page = await waitForCurrentPagePath(miniProgram, INDEX_ROUTE, timeoutMs)
    ?? await miniProgram.reLaunch(INDEX_ROUTE).catch(() => null)
  if (!page) {
    return null
  }

  await page.waitForRendered({
    selector: INDEX_ROUTE_MARKER_SELECTOR,
    dataset: { e2eRoute: 'index' },
    timeout: timeoutMs,
  })
  return page
}

async function collectAppSnapshot(root: string) {
  const miniProgram = await launchFreshMiniProgram(root)
  try {
    const page = await waitForIndexPageRendered(miniProgram)
    if (!page) {
      throw new Error(`Failed to render ${INDEX_ROUTE}`)
    }
    await page.waitFor(300)
    const toolInfo = await miniProgram.toolInfo()
    const snapshot = await miniProgram.evaluate(async () => {
      const app = getApp()
      if (typeof app?.finalizeLifecycleLogs === 'function') {
        app.finalizeLifecycleLogs()
      }
      const systemInfo = wx.getSystemInfoSync()
      const capabilityNames = [
        'queueMicrotask',
        'fetch',
        'Headers',
        'Request',
        'Response',
        'AbortController',
        'AbortSignal',
        'XMLHttpRequest',
        'WebSocket',
        'URL',
        'URLSearchParams',
        'Blob',
        'File',
        'FormData',
        'TextEncoder',
        'TextDecoder',
        'atob',
        'btoa',
        'performance',
        'crypto',
        'Event',
        'CustomEvent',
        'window',
        'document',
        'navigator',
        'self',
        'global',
        'location',
        'process',
        'Buffer',
        'localStorage',
        'sessionStorage',
        'setImmediate',
        'structuredClone',
      ]
      const globals: Record<string, string> = {}
      for (const name of capabilityNames) {
        globals[name] = typeof (globalThis as Record<string, unknown>)[name]
      }

      const microtaskOrder = ['sync']
      if (typeof queueMicrotask === 'function') {
        await new Promise<void>((resolve) => {
          queueMicrotask(() => {
            microtaskOrder.push('microtask')
            resolve()
          })
        })
      }
      else {
        microtaskOrder.push('missing')
      }

      return {
        capabilities: {
          globals,
          metadata: {
            SDKVersion: systemInfo.SDKVersion,
            platform: systemInfo.platform,
            renderer: (systemInfo as Record<string, unknown>).renderer ?? 'unknown',
          },
          semantics: {
            arrayAt: [1, 2].at(-1),
            arrayFlat: [[1], [2]].flat().join(','),
            arrayFlatMap: [1, 2].flatMap(value => [value, value]).join(','),
            objectFromEntries: Object.fromEntries([['ready', true]]).ready,
            objectHasOwn: Object.hasOwn({ ready: true }, 'ready'),
            promiseAllSettled: (await Promise.allSettled([Promise.resolve('ready')]))[0]?.status,
            promiseAny: await Promise.any([Promise.resolve('ready')]),
            replaceAll: 'a:a'.replaceAll(':', '-'),
          },
          microtaskOrder,
        },
        logs: app?.globalData?.__lifecycleLogs ?? [],
      }
    })
    return {
      capabilities: snapshot?.capabilities,
      logs: snapshot?.logs ?? [],
      toolInfo,
    }
  }
  finally {
    await miniProgram.close().catch(() => {})
  }
}

function normalizeEntries(entries: any[]) {
  const normalized = entries.map(({ source, ...rest }) => rest)
  const seenHooks = new Set(normalized.map(entry => String(entry?.hook ?? '')))

  for (const hook of APP_HOOKS) {
    if (seenHooks.has(hook)) {
      continue
    }
    normalized.push({
      hook,
      order: normalized.length + 1,
      args: null,
      skipped: true,
      snapshot: {
        lastHook: hook,
        tick: normalized.length + 1,
      },
    })
  }

  return normalized
}

describe('app lifecycle compare (e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniPrograms()
  })

  it('compares wevu app lifecycle logs against native', async () => {
    const native = await collectAppSnapshot(APP_NATIVE_ROOT)
    const wevuTs = await collectAppSnapshot(APP_WEVU_TS_ROOT)
    const wevuVue = await collectAppSnapshot(APP_WEVU_VUE_ROOT)

    expect(native.logs.length).toBeGreaterThan(0)
    expect(normalizeEntries(wevuTs.logs)).toEqual(normalizeEntries(native.logs))
    expect(normalizeEntries(wevuVue.logs)).toEqual(normalizeEntries(native.logs))

    const capability = native.capabilities!
    process.stdout.write(`[app-service-capabilities] ${JSON.stringify({
      devtoolsVersion: native.toolInfo?.version,
      ...capability.metadata,
      globals: capability.globals,
    })}\n`)
    expect(capability.globals).toMatchObject({
      fetch: 'undefined',
      process: 'undefined',
      Buffer: 'undefined',
      URLSearchParams: 'undefined',
      structuredClone: 'undefined',
    })
    expect(capability.globals.queueMicrotask).toMatch(/^(function|undefined)$/)
    expect(capability.microtaskOrder).toEqual(
      capability.globals.queueMicrotask === 'function'
        ? ['sync', 'microtask']
        : ['sync', 'missing'],
    )
    expect(capability.semantics).toEqual({
      arrayAt: 2,
      arrayFlat: '1,2',
      arrayFlatMap: '1,1,2,2',
      objectFromEntries: true,
      objectHasOwn: true,
      promiseAllSettled: 'fulfilled',
      promiseAny: 'ready',
      replaceAll: 'a-a',
    })
  })
})
