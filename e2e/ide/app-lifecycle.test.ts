import type { HostLifecycleEvidence } from '../../e2e-apps/shared/appLifecycle/observer'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, describe, expect, it } from 'vitest'
import { assertHostLifecycleForwarding, lifecycleStructure } from '../utils/appLifecycleEvidence'
import { launchAutomator } from '../utils/automator'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'
import { createDomAcceptance } from '../utils/domAcceptance'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'
import { resolveRuntimeProviderName } from '../utils/runtimeProvider'
import { waitForCurrentPagePath } from './github-issues.runtime.shared'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_NATIVE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-native')
const APP_WEVU_TS_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-ts')
const APP_WEVU_VUE_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/app-lifecycle-wevu-vue')
const AUTOMATOR_SKIP_WARMUP_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_SKIP_WARMUP'
const INDEX_ROUTE = '/pages/index/index'
const INDEX_ROUTE_MARKER_SELECTOR = '#app-lifecycle-route'

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
  const isDevtools = resolveRuntimeProviderName() === 'devtools'
  if (isDevtools) {
    await cleanupResidualIdeProcesses()
  }

  if (!sharedBuildPreparedRoots.has(root)) {
    // 同一路径首次打开前先清理 IDE 缓存，避免 DevTools 复用旧 app.json/compile 状态导致模拟器首启失败。
    if (isDevtools) {
      await cleanDevtoolsCache('all', { cwd: root })
    }
    await runBuild(root)
    sharedBuildPreparedRoots.add(root)
  }

  const startupEnv = [AUTOMATOR_SKIP_WARMUP_ENV, 'WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH', 'WEAPP_VITE_E2E_AUTOMATOR_BRIDGE_POST_CONNECT_REFRESH']
  const previous = startupEnv.map(name => [name, process.env[name]] as const)
  try {
    for (const name of startupEnv) {
      delete process.env[name]
    }
    return await launchAutomator({
      projectPath: root,
      maxLaunchRetries: 1,
      retryWarmupTimeout: false,
      disableRelaunchSessionRecovery: true,
      refreshProjectAfterConnect: false,
      skipRelaunchPageRootCheck: true,
      warmupAllowRelaunch: false,
      warmupRootSelectors: [INDEX_ROUTE_MARKER_SELECTOR],
      warmupRoute: INDEX_ROUTE,
    })
  }
  finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name]
      }
      else {
        process.env[name] = value
      }
    }
  }
}

async function closeSharedMiniPrograms() {
  if (resolveRuntimeProviderName() === 'devtools') {
    await cleanupResidualIdeProcesses()
  }
}

async function waitForIndexPageRendered(miniProgram: any, timeoutMs = 30_000) {
  const page = await waitForCurrentPagePath(miniProgram, INDEX_ROUTE, timeoutMs)
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

async function collectAppSnapshot(root: string, variant: string, dom: ReturnType<typeof createDomAcceptance>) {
  // 每个 fixture 使用不同 App 实现，必须分别冷启动才能比较 onLaunch。
  const miniProgram = await launchFreshMiniProgram(root)
  try {
    const page = await waitForIndexPageRendered(miniProgram)
    if (!page) {
      throw new Error(`Failed to render ${INDEX_ROUTE}`)
    }
    await page.waitFor(300)
    await dom.check(`${variant}:initial`, miniProgram, page)
    const toolInfo = await miniProgram.toolInfo()
    const snapshot = await miniProgram.evaluate(async () => {
      const app = getApp()
      if (typeof app?.finalizeLifecycleLogs === 'function') {
        app.finalizeLifecycleLogs()
      }
      if (typeof app?.readHostLifecycle !== 'function') {
        // eslint-disable-next-line unicorn/prefer-type-error -- 格式修正保持既有观察器失败类型不变。
        throw new Error('Missing cold-start host boundary observer')
      }
      const hostLifecycle = app.readHostLifecycle()
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
        // DevTools 代理包装不接受全局对象作为接收者，使用独立调用验证原生调度能力。
        const enqueueMicrotask = queueMicrotask
        await new Promise<void>((resolve) => {
          enqueueMicrotask(() => {
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
        hostLifecycle,
        logs: app?.globalData?.__lifecycleLogs ?? [],
      }
    })
    const hostLifecycle = snapshot.hostLifecycle as HostLifecycleEvidence
    process.stdout.write(`[app-lifecycle-host-boundary] ${JSON.stringify({ variant, ...hostLifecycle })}\n`)
    assertHostLifecycleForwarding(hostLifecycle, snapshot.logs)
    await page.callMethod('refreshLifecycleSummary')
    await dom.check(`${variant}:finalized`, miniProgram, page)
    for (const hook of ['onLaunch', 'onShow']) {
      const input = hostLifecycle.host.find(entry => entry.hook === hook)
      expect(input, `${variant}: ${hook} host input`).toBeDefined()
      for (const source of ['host', 'hook']) {
        const nodes = await page.$$(`#app-${source}-input-${hook}`, { fallback: false, timeout: 5_000 })
        expect(nodes).toHaveLength(1)
        expect(await nodes[0].text(), `${variant}: rendered ${source} ${hook} input`).toBe(input!.summary)
      }
    }
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

describe('app lifecycle compare (e2e)', { concurrent: false }, () => {
  afterAll(async () => {
    await closeSharedMiniPrograms()
  })

  it('compares wevu app lifecycle logs against native', async (ctx) => {
    const dom = createDomAcceptance(ctx, 'e2e-apps', ['native', 'wevu-ts', 'wevu-vue'].flatMap(variant => [
      {
        id: `${variant}:initial`,
        route: INDEX_ROUTE,
        action: `冷启动 e2e-apps/app-lifecycle-${variant} 并检查实际启动 hook 状态`,
        nodes: [
          { selector: '#app-lifecycle-route', text: variant === 'native' ? 'App lifecycle native' : 'App lifecycle wevu' },
          { selector: '#app-hook-onLaunch', text: 'onLaunch: observed' },
          { selector: '#app-hook-onShow', text: 'onShow: observed' },
          { selector: '#app-hook-onError', text: 'onError: pending' },
          { selector: '.app-hook-status', count: 7 },
          { selector: '.app-host-input', count: 2 },
          { selector: '.app-hook-input', count: 2 },
        ],
      },
      {
        id: `${variant}:finalized`,
        route: INDEX_ROUTE,
        action: `归档 e2e-apps/app-lifecycle-${variant} 日志并刷新实际 hook 状态`,
        nodes: [
          { selector: '#app-hook-onLaunch', text: 'onLaunch: observed' },
          { selector: '#app-hook-onShow', text: 'onShow: observed' },
          { selector: '#app-hook-onError', text: 'onError: skipped' },
          { selector: '#app-hook-onUnhandledRejection', text: 'onUnhandledRejection: skipped' },
          { selector: '.app-hook-status', count: 7 },
          { selector: '.app-host-input', count: 2 },
          { selector: '.app-hook-input', count: 2 },
        ],
      },
    ]))
    const native = await collectAppSnapshot(APP_NATIVE_ROOT, 'native', dom)
    const wevuTs = await collectAppSnapshot(APP_WEVU_TS_ROOT, 'wevu-ts', dom)
    const wevuVue = await collectAppSnapshot(APP_WEVU_VUE_ROOT, 'wevu-vue', dom)

    expect(native.logs.length).toBeGreaterThan(0)
    expect(lifecycleStructure(wevuTs.logs)).toEqual(lifecycleStructure(native.logs))
    expect(lifecycleStructure(wevuVue.logs)).toEqual(lifecycleStructure(native.logs))

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
