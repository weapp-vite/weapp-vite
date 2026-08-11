import path from 'node:path'
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
const CONTROL_FILE = path.join(APP_ROOT, 'dist/__weapp_vite_hmr/control.js')
const DIST_NATIVE_JS = path.join(APP_ROOT, 'dist/pages/native/index.js')
const NATIVE_SOURCE = path.join(APP_ROOT, 'src/pages/native/index.ts')
const PRIVATE_CONFIG = path.join(APP_ROOT, 'project.private.config.json')
const NATIVE_ROUTE = '/pages/native/index?source=classic-auto-e2e'

interface ClassicRuntimeState {
  count: number
  identity: string
  input: string
  marker: string
  source: string
}

let miniProgram: any
let devProcess: ReturnType<typeof startDevProcess> | undefined
let originalNativeSource = ''
let originalPrivateConfig = ''

function normalizeNativeSource(source: string) {
  return source
    .replace('STATEFUL-NATIVE-PATCHED', 'STATEFUL-NATIVE-BASE')
    .replace('this.data.count + 2', 'this.data.count + 1')
}

async function readRuntimeState(): Promise<ClassicRuntimeState> {
  return await miniProgram.evaluate(() => {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1] as any
    return {
      count: Number(page.data?.count),
      identity: String(page.__statefulHmrIdentity ?? ''),
      input: String(page.data?.input ?? ''),
      marker: String(page.data?.marker ?? ''),
      source: String(page.options?.source ?? ''),
    }
  })
}

async function waitForRuntimeState(
  predicate: (state: ClassicRuntimeState) => boolean,
  timeoutMs = 30_000,
): Promise<ClassicRuntimeState> {
  const startedAt = Date.now()
  let latest: ClassicRuntimeState | undefined
  while (Date.now() - startedAt < timeoutMs) {
    latest = await readRuntimeState().catch(() => undefined)
    if (latest && predicate(latest)) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for classic runtime state: ${JSON.stringify(latest)}`)
}

async function connectAutomatorSession() {
  return await launchAutomator({
    launchMode: 'bridge',
    projectPath: APP_ROOT,
    retryWarmupTimeout: true,
    timeout: 120_000,
    warmupRootSelectors: ['.page'],
    warmupRoute: NATIVE_ROUTE,
  })
}

describe.sequential('automatic classic HMR in real WeChat DevTools', () => {
  beforeAll(async () => {
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
    await cleanDevtoolsCache('all', { cwd: APP_ROOT })

    originalNativeSource = await fs.readFile(NATIVE_SOURCE, 'utf8')
    originalPrivateConfig = await fs.readFile(PRIVATE_CONFIG, 'utf8')
    const privateConfig = JSON.parse(originalPrivateConfig) as {
      setting?: Record<string, unknown>
    }
    privateConfig.setting = {
      ...(privateConfig.setting ?? {}),
      compileHotReLoad: false,
    }
    await fs.writeFile(PRIVATE_CONFIG, `${JSON.stringify(privateConfig, null, 2)}\n`, 'utf8')
    await fs.writeFile(NATIVE_SOURCE, normalizeNativeSource(originalNativeSource), 'utf8')
    await fs.remove(path.join(APP_ROOT, 'dist'))

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
    await devProcess.waitFor(
      waitForFileContains(DIST_NATIVE_JS, 'STATEFUL-NATIVE-BASE'),
      'classic HMR initial page output',
    )
    expect(await fs.pathExists(CONTROL_FILE)).toBe(false)

    miniProgram = await connectAutomatorSession()
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
    if (originalPrivateConfig) {
      await fs.writeFile(PRIVATE_CONFIG, originalPrivateConfig, 'utf8')
    }
    await cleanupResidualDevProcesses()
    await cleanupResidualIdeProcesses()
  })

  it('uses direct output and reloads the page instead of preserving its state', async () => {
    await miniProgram.reLaunch(NATIVE_ROUTE)
    await waitForRuntimeState(state => state.marker === 'STATEFUL-NATIVE-BASE')
    await miniProgram.evaluate(() => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1] as any
      page.__statefulHmrIdentity = 'classic-instance'
      page.setData({ input: 'classic-held-input' })
      page.increment()
    })
    expect(await waitForRuntimeState(state => state.count === 1)).toEqual({
      count: 1,
      identity: 'classic-instance',
      input: 'classic-held-input',
      marker: 'STATEFUL-NATIVE-BASE',
      source: 'classic-auto-e2e',
    })

    const updatedSource = normalizeNativeSource(originalNativeSource)
      .replace('STATEFUL-NATIVE-BASE', 'STATEFUL-NATIVE-PATCHED')
      .replace('this.data.count + 1', 'this.data.count + 2')
    await replaceFileByRename(NATIVE_SOURCE, updatedSource)
    await devProcess!.waitFor(
      waitForFileContains(DIST_NATIVE_JS, 'this.data.count + 2'),
      'classic HMR direct page output update',
    )

    await miniProgram.disconnect()
    miniProgram = await connectAutomatorSession()
    const reloaded = await waitForRuntimeState(state => (
      state.marker === 'STATEFUL-NATIVE-PATCHED'
      && state.source === 'classic-auto-e2e'
    ))
    expect(reloaded).toEqual({
      count: 0,
      identity: '',
      input: '',
      marker: 'STATEFUL-NATIVE-PATCHED',
      source: 'classic-auto-e2e',
    })

    await miniProgram.evaluate(() => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1] as any
      page.increment()
    })
    expect((await waitForRuntimeState(state => state.count === 2)).count).toBe(2)
  })
})
