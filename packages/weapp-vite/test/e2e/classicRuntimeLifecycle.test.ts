import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

type Hook = () => void | Promise<void>
type CleanupStage = 'session' | 'dev' | 'source' | 'config' | 'residual-dev' | 'residual-ide'

const cleanupOrder: CleanupStage[] = ['session', 'dev', 'source', 'config', 'residual-dev', 'residual-ide']
const mockedModules = [
  'vitest',
  '@weapp-core/shared/node',
  '../../scripts/consumerRuntimeHost.mjs',
  '../../../../e2e/utils/automator',
  '../../../../e2e/utils/dev-process',
  '../../../../e2e/utils/dev-process-cleanup',
  '../../../../e2e/utils/dev-process-env',
  '../../../../e2e/utils/domAcceptance',
  '../../../../e2e/utils/hmr-helpers',
  '../../../../e2e/utils/ide-devtools-cleanup',
  '../../../../e2e/utils/runtimeProvider',
]

async function loadSuite(provider = 'devtools') {
  const hooks: { setup?: Hook, teardown?: Hook } = {}
  const errors = new Map<CleanupStage, Error>()
  const events: CleanupStage[] = []
  let cleaning = false
  const release = async (stage: CleanupStage) => {
    if (!cleaning) {
      return
    }
    events.push(stage)
    if (errors.has(stage)) {
      throw errors.get(stage)
    }
  }
  const session = {
    close: vi.fn(async () => release('session')),
    disconnect: vi.fn(async () => release('session')),
  }
  const dev = {
    stop: vi.fn(async () => release('dev')),
    waitFor: vi.fn(async () => {}),
  }
  const launch = vi.fn(async () => session)
  const startDev = vi.fn(() => dev)
  const cleanupDev = vi.fn(async () => release('residual-dev'))
  const cleanupIde = vi.fn(async () => release('residual-ide'))
  const cleanupCombined = vi.fn(async () => {
    await cleanupDev()
    await cleanupIde()
  })
  vi.stubEnv('WEAPP_VITE_E2E_CLASSIC_PROJECT', undefined)
  vi.stubEnv('WEAPP_VITE_E2E_COMPILER_HOST', 'wv')
  vi.doMock('vitest', () => ({
    beforeAll: (hook: Hook) => hooks.setup = hook,
    afterAll: (hook: Hook) => hooks.teardown = hook,
    describe: (_name: string, _options: unknown, register: () => void) => register(),
    it: () => {},
    expect,
  }))
  // 只执行捕获的 hook；所有文件、构建、进程和 IDE 依赖均使用内存 mock。
  vi.doMock('@weapp-core/shared/node', () => ({ fs: {
    readFile: vi.fn(async (file: string) => path.basename(file) === 'index.ts' ? 'STATEFUL-NATIVE-BASE' : '{}'),
    writeFile: vi.fn(async (file: string) => release(path.basename(file) === 'index.ts' ? 'source' : 'config')),
    remove: vi.fn(async () => {}),
    pathExists: vi.fn(async () => false),
  } }))
  vi.doMock('../../scripts/consumerRuntimeHost.mjs', () => ({
    resolveRuntimeCompilerCli: () => 'mock-compiler-cli',
    selectClassicRuntimeHost: () => 'wv',
  }))
  vi.doMock('../../../../e2e/utils/automator', () => ({ launchAutomator: launch, reconnectAutomator: vi.fn() }))
  vi.doMock('../../../../e2e/utils/dev-process', () => ({ startDevProcess: startDev }))
  vi.doMock('../../../../e2e/utils/dev-process-cleanup', () => ({ cleanupResidualDevProcesses: cleanupDev }))
  vi.doMock('../../../../e2e/utils/dev-process-env', () => ({ createDevProcessEnv: () => ({}) }))
  vi.doMock('../../../../e2e/utils/domAcceptance', () => ({ createDomAcceptance: vi.fn() }))
  vi.doMock('../../../../e2e/utils/hmr-helpers', () => ({ replaceFileByRename: vi.fn(), waitForFileContains: vi.fn(async () => {}) }))
  vi.doMock('../../../../e2e/utils/ide-devtools-cleanup', () => ({
    cleanupResidualDevtoolsProcesses: cleanupIde,
    cleanupResidualIdeProcesses: cleanupCombined,
  }))
  vi.doMock('../../../../e2e/utils/runtimeProvider', () => ({ resolveRuntimeProviderName: () => provider }))
  const suiteModule = '../../../../e2e/ide/hmr-auto-classic.runtime.test'
  await import(suiteModule)
  await hooks.setup!()
  cleanupDev.mockClear()
  cleanupIde.mockClear()
  cleanupCombined.mockClear()
  cleaning = true
  return { ...hooks, errors, events, session, dev, launch, startDev, cleanupDev, cleanupIde, cleanupCombined }
}

afterEach(() => {
  for (const module of mockedModules) {
    vi.doUnmock(module)
  }
  vi.resetModules()
  vi.unstubAllEnvs()
})

it('releases each resource in order and clears the session and dev references', async () => {
  const suite = await loadSuite()
  await suite.teardown!()
  expect(suite.events).toEqual(cleanupOrder)
  expect(suite.session.disconnect).toHaveBeenCalledOnce()
  expect(suite.session.close).not.toHaveBeenCalled()
  expect(suite.dev.stop).toHaveBeenCalledExactlyOnceWith(5_000)
  await suite.teardown!()
  expect(suite.session.disconnect).toHaveBeenCalledOnce()
  expect(suite.dev.stop).toHaveBeenCalledOnce()
  expect(suite.launch).toHaveBeenCalledOnce()
  expect(suite.startDev).toHaveBeenCalledOnce()
})

it.each(['devtools', 'headless'])('continues all cleanup stages after %s session release fails', async (provider) => {
  const suite = await loadSuite(provider)
  const failure = new Error('session release failed')
  suite.errors.set('session', failure)
  await expect(suite.teardown!()).rejects.toMatchObject({ errors: [expect.objectContaining({ cause: failure })] })
  expect(suite.events).toEqual(cleanupOrder)
  expect(provider === 'headless' ? suite.session.close : suite.session.disconnect).toHaveBeenCalledOnce()
  await suite.teardown!()
  expect(suite.session.close.mock.calls.length + suite.session.disconnect.mock.calls.length).toBe(1)
  expect(suite.dev.stop).toHaveBeenCalledOnce()
})

it.each<CleanupStage>(['dev', 'source', 'config', 'residual-dev', 'residual-ide'])('continues the remaining cleanup after %s fails', async (stage) => {
  const suite = await loadSuite()
  const failure = new Error(`${stage} cleanup failed`)
  suite.errors.set(stage, failure)
  await expect(suite.teardown!()).rejects.toMatchObject({ errors: [expect.objectContaining({ cause: failure })] })
  expect(suite.events).toEqual(cleanupOrder)
  expect(suite.session.disconnect).toHaveBeenCalledOnce()
  expect(suite.dev.stop).toHaveBeenCalledOnce()
  expect(suite.cleanupDev).toHaveBeenCalledOnce()
  expect(suite.cleanupIde).toHaveBeenCalledOnce()
  expect(suite.cleanupCombined).not.toHaveBeenCalled()
})

it('preserves every cleanup failure in lifecycle order with its original cause', async () => {
  const suite = await loadSuite()
  const failures = cleanupOrder.map(stage => new Error(`${stage} failed`))
  cleanupOrder.forEach((stage, index) => suite.errors.set(stage, failures[index]!))
  await expect(suite.teardown!()).rejects.toMatchObject({
    errors: failures.map(cause => expect.objectContaining({ cause })),
  })
  expect(suite.events).toEqual(cleanupOrder)
  expect(suite.launch).toHaveBeenCalledOnce()
  expect(suite.startDev).toHaveBeenCalledOnce()
})
