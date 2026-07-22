import path from 'node:path'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchAutomator } from '../utils/automator'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename, waitForFileContains } from '../utils/hmr-helpers'
import { cleanDevtoolsCache, cleanupResidualIdeProcesses } from '../utils/ide-devtools-cleanup'

const ROOT = path.resolve(import.meta.dirname, '../..')
const APP_ROOT = path.join(ROOT, 'e2e-apps/stateful-hmr')
const CLI_PATH = path.join(ROOT, 'packages/weapp-vite/bin/weapp-vite.js')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const CONTROL_FILE = path.join(DIST_ROOT, '__weapp_vite_hmr/control.js')
const UPDATE_FILE = path.join(DIST_ROOT, '__weapp_vite_hmr/update.js')
const NATIVE_SOURCE = path.join(APP_ROOT, 'src/pages/native/index.ts')
const COMPONENT_SOURCE = path.join(APP_ROOT, 'src/pages/component/index.ts')
const WEVU_SOURCE = path.join(APP_ROOT, 'src/pages/wevu/index.vue')
const NATIVE_ROUTE = '/pages/native/index?source=e2e'
const COMPONENT_ROUTE = '/pages/component/index?source=e2e'
const WEVU_ROUTE = '/pages/wevu/index?source=e2e'
const AUTOMATOR_LAUNCH_MODE_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_LAUNCH_MODE'
const POST_CONNECT_REFRESH_ENV = 'WEAPP_VITE_E2E_AUTOMATOR_POST_CONNECT_REFRESH'

interface RuntimeState {
  count: number
  identity: string
  input: string
  route: string
  source: string
}

let miniProgram: any
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalComponentSource = ''
let originalNativeSource = ''
let originalWevuSource = ''
let previousAutomatorLaunchMode: string | undefined
let previousPostConnectRefresh: string | undefined

function normalizeFixtureSource(source: string, runtime: 'component' | 'native' | 'wevu'): string {
  if (runtime === 'wevu') {
    return source
      .replace('STATEFUL-WEVU-PATCHED', 'STATEFUL-WEVU-BASE')
      .replace('count.value += 2', 'count.value += 1')
  }
  const prefix = runtime === 'native' ? 'NATIVE' : 'COMPONENT'
  return source
    .replace(`STATEFUL-${prefix}-PATCHED`, `STATEFUL-${prefix}-BASE`)
    .replace('this.data.count + 2', 'this.data.count + 1')
}

async function readRuntimeState(page?: any): Promise<RuntimeState> {
  const metadata = await miniProgram.evaluate(() => {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1] as any
    return {
      data: currentPage.data,
      identity: String(currentPage.__statefulHmrIdentity ?? ''),
      route: String(currentPage.route ?? currentPage.__route__ ?? ''),
      source: String(currentPage.options?.source ?? ''),
    }
  })
  const data = page ? await page.data() : metadata.data
  return {
    count: Number(data?.count),
    identity: metadata.identity,
    input: String(data?.input ?? ''),
    route: metadata.route,
    source: metadata.source,
  }
}

async function prepareRuntimeState(identity: string) {
  return await miniProgram.evaluate((payload: { identity: string }) => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    page.__statefulHmrIdentity = payload.identity
    page.setData({ input: 'held-input' })
    return page.data
  }, { identity })
}

async function triggerIncrement(runtime: 'component' | 'native' | 'wevu', page?: any): Promise<unknown> {
  if (runtime === 'wevu') {
    return await page.callMethod('__weapp_vite_inline', {
      type: 'tap',
      currentTarget: {
        dataset: {
          wiTap: 'i0',
        },
      },
    })
    return
  }
  if (runtime === 'component') {
    await page.callMethod('increment')
    return
  }
  await miniProgram.evaluate((expectedRuntime: 'native' | 'wevu') => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    if (typeof page.increment !== 'function') {
      throw new TypeError(`${expectedRuntime} page increment is unavailable`)
    }
    page.increment()
  }, runtime)
}

async function waitForPatchedBehavior(expectedCount: number, page?: any, timeoutMs = 30_000): Promise<RuntimeState> {
  const start = Date.now()
  let latest: RuntimeState | undefined
  let latestError = ''
  while (Date.now() - start < timeoutMs) {
    latest = await readRuntimeState(page).catch((error: unknown) => {
      latestError = error instanceof Error ? error.message : String(error)
      return undefined
    })
    if (latest?.count === expectedCount) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  const runtimeLogs = miniProgram.__weappViteRuntimeLogMeta?.entries ?? []
  throw new Error(`Timed out waiting for patched runtime count ${expectedCount}; latest=${JSON.stringify(latest)}; error=${latestError}; logs=${JSON.stringify(runtimeLogs)}`)
}

async function waitForClientVersion(expectedVersion: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  let latest = -1
  while (Date.now() - start < timeoutMs) {
    latest = await miniProgram.evaluate(() => {
      const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
      return typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1
    }).catch(() => -1)
    if (latest === expectedVersion) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for stateful HMR client version ${expectedVersion}; latest=${latest}`)
}

async function readClientVersion(): Promise<number> {
  return await miniProgram.evaluate(() => {
    const client = (globalThis as any).__WEAPP_VITE_STATEFUL_HMR_CLIENT__
    return typeof client?.getVersion === 'function' ? Number(client.getVersion()) : -1
  })
}

describe.sequential('stateful HMR in real WeChat DevTools', () => {
  beforeAll(async () => {
    previousAutomatorLaunchMode = process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    previousPostConnectRefresh = process.env[POST_CONNECT_REFRESH_ENV]
    process.env[AUTOMATOR_LAUNCH_MODE_ENV] = 'direct'
    process.env[POST_CONNECT_REFRESH_ENV] = '1'
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
    await cleanDevtoolsCache('all', { cwd: APP_ROOT })
    originalComponentSource = normalizeFixtureSource(await fs.readFile(COMPONENT_SOURCE, 'utf8'), 'component')
    originalNativeSource = normalizeFixtureSource(await fs.readFile(NATIVE_SOURCE, 'utf8'), 'native')
    originalWevuSource = normalizeFixtureSource(await fs.readFile(WEVU_SOURCE, 'utf8'), 'wevu')
    await Promise.all([
      fs.writeFile(COMPONENT_SOURCE, originalComponentSource, 'utf8'),
      fs.writeFile(NATIVE_SOURCE, originalNativeSource, 'utf8'),
      fs.writeFile(WEVU_SOURCE, originalWevuSource, 'utf8'),
    ])
    await fs.remove(DIST_ROOT)

    devProcess = startDevProcess(process.execPath, [
      CLI_PATH,
      'dev',
      APP_ROOT,
      '--platform',
      'weapp',
      '--skipNpm',
    ], {
      all: true,
      cwd: APP_ROOT,
      env: createDevProcessEnv(),
      reject: false,
    })
    await devProcess.waitFor(waitForFileContains(CONTROL_FILE, 'http://127.0.0.1:'), 'stateful HMR control ready')

    miniProgram = await launchAutomator({
      projectPath: APP_ROOT,
      timeout: 120_000,
      warmupRootSelectors: ['.page'],
      warmupRoute: NATIVE_ROUTE,
    })
  }, 600_000)

  afterAll(async () => {
    try {
      await miniProgram?.disconnect?.()
    }
    catch {}
    miniProgram = undefined
    try {
      await devProcess?.stop(5_000)
    }
    catch {}
    devProcess = undefined
    if (originalNativeSource) {
      await fs.writeFile(NATIVE_SOURCE, originalNativeSource, 'utf8')
    }
    if (originalComponentSource) {
      await fs.writeFile(COMPONENT_SOURCE, originalComponentSource, 'utf8')
    }
    if (originalWevuSource) {
      await fs.writeFile(WEVU_SOURCE, originalWevuSource, 'utf8')
    }
    if (previousAutomatorLaunchMode === undefined) {
      delete process.env[AUTOMATOR_LAUNCH_MODE_ENV]
    }
    else {
      process.env[AUTOMATOR_LAUNCH_MODE_ENV] = previousAutomatorLaunchMode
    }
    if (previousPostConnectRefresh === undefined) {
      delete process.env[POST_CONNECT_REFRESH_ENV]
    }
    else {
      process.env[POST_CONNECT_REFRESH_ENV] = previousPostConnectRefresh
    }
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
  })

  it('preserves native Page identity, data, input, route, and query across a JavaScript patch', async () => {
    await miniProgram.reLaunch(NATIVE_ROUTE)
    await prepareRuntimeState('native-instance')
    await triggerIncrement('native')
    expect(await readRuntimeState()).toEqual({
      count: 1,
      identity: 'native-instance',
      input: 'held-input',
      route: 'pages/native/index',
      source: 'e2e',
    })

    const updatedSource = originalNativeSource
      .replace('STATEFUL-NATIVE-BASE', 'STATEFUL-NATIVE-PATCHED')
      .replace('this.data.count + 1', 'this.data.count + 2')
    const clientVersion = await readClientVersion()
    await replaceFileByRename(NATIVE_SOURCE, updatedSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'this.data.count + 2'), 'native literal patch published')
    await waitForClientVersion(clientVersion + 1)

    await triggerIncrement('native')
    const state = await waitForPatchedBehavior(3)
    expect(state).toEqual({
      count: 3,
      identity: 'native-instance',
      input: 'held-input',
      route: 'pages/native/index',
      source: 'e2e',
    })
  })

  it('rehydrates wevu setup refs while preserving the native page instance', async () => {
    const page = await miniProgram.reLaunch(WEVU_ROUTE)
    await waitForPatchedBehavior(0, page)
    await prepareRuntimeState('wevu-instance')
    await triggerIncrement('wevu', page)
    await triggerIncrement('wevu', page)
    expect(await waitForPatchedBehavior(2, page)).toEqual({
      count: 2,
      identity: 'wevu-instance',
      input: 'held-input',
      route: 'pages/wevu/index',
      source: 'e2e',
    })

    const updatedSource = originalWevuSource
      .replace('STATEFUL-WEVU-BASE', 'STATEFUL-WEVU-PATCHED')
      .replace('count.value += 1', 'count.value += 2')
    const clientVersion = await readClientVersion()
    await replaceFileByRename(WEVU_SOURCE, updatedSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'count.value += 2'), 'wevu literal patch published')
    await waitForClientVersion(clientVersion + 1)

    await triggerIncrement('wevu', page)
    const state = await waitForPatchedBehavior(4, page)
    expect(state).toEqual({
      count: 4,
      identity: 'wevu-instance',
      input: 'held-input',
      route: 'pages/wevu/index',
      source: 'e2e',
    })
  })

  it('preserves native Component identity, data, input, route, and query across a JavaScript patch', async () => {
    const page = await miniProgram.reLaunch(COMPONENT_ROUTE)
    await waitForPatchedBehavior(0, page)
    await prepareRuntimeState('component-instance')
    await triggerIncrement('component', page)
    expect(await waitForPatchedBehavior(1, page)).toEqual({
      count: 1,
      identity: 'component-instance',
      input: 'held-input',
      route: 'pages/component/index',
      source: 'e2e',
    })

    const updatedSource = originalComponentSource
      .replace('STATEFUL-COMPONENT-BASE', 'STATEFUL-COMPONENT-PATCHED')
      .replace('this.data.count + 1', 'this.data.count + 2')
    const clientVersion = await readClientVersion()
    await replaceFileByRename(COMPONENT_SOURCE, updatedSource)
    await devProcess!.waitFor(waitForFileContains(UPDATE_FILE, 'this.data.count + 2'), 'component literal patch published')
    await waitForClientVersion(clientVersion + 1)

    await triggerIncrement('component', page)
    expect(await waitForPatchedBehavior(3, page)).toEqual({
      count: 3,
      identity: 'component-instance',
      input: 'held-input',
      route: 'pages/component/index',
      source: 'e2e',
    })
  })
})
