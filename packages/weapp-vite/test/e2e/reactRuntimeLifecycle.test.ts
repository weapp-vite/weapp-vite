import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'

type Hook = () => void | Promise<void>

interface MockSession {
  reLaunch: ReturnType<typeof vi.fn>
  evaluate: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

const mockedModules = [
  'vitest',
  'node:fs/promises',
  'execa',
  '../../../../e2e/utils/automator',
  '../../../../e2e/utils/buildLog',
  '../../../../e2e/utils/domAcceptance',
  '../../../../e2e/utils/ide-devtools-cleanup',
  '../../../../e2e/utils/runtimeProvider',
  '../../../../e2e/ide/reactRuntimeDom',
]

async function loadSuite(launch: () => Promise<MockSession>, provider = 'devtools') {
  const hooks: { setup?: Hook, teardown?: Hook } = {}
  const cleanup = vi.fn(async () => {})
  vi.stubEnv('WEAPP_VITE_E2E_REACT_PROJECT', undefined)
  vi.stubEnv('WEAPP_VITE_E2E_COMPILER_HOST', 'wv')
  vi.doMock('vitest', () => ({
    beforeAll: (hook: Hook) => hooks.setup = hook,
    afterAll: (hook: Hook) => hooks.teardown = hook,
    describe: (_name: string, _options: unknown, register: () => void) => register(),
    it: () => {},
    expect,
  }))
  // 只捕获 suite 生命周期；不构建、不访问项目文件、不导入真实 IDE 入口。
  vi.doMock('node:fs/promises', () => ({ default: { rm: vi.fn(async () => {}) } }))
  vi.doMock('execa', () => ({ execa: vi.fn() }))
  vi.doMock('../../../../e2e/utils/automator', () => ({ launchAutomator: launch }))
  vi.doMock('../../../../e2e/utils/buildLog', () => ({ runWeappViteBuildWithLogCapture: vi.fn(async () => {}) }))
  vi.doMock('../../../../e2e/utils/domAcceptance', () => ({ createDomAcceptance: vi.fn() }))
  vi.doMock('../../../../e2e/utils/ide-devtools-cleanup', () => ({ cleanupResidualIdeProcesses: cleanup }))
  vi.doMock('../../../../e2e/utils/runtimeProvider', () => ({ resolveRuntimeProviderName: () => provider }))
  vi.doMock('../../../../e2e/ide/reactRuntimeDom', () => ({}))
  // 使用文件 URL 并绕过 Vite 的动态 import 解析。根级 `pnpm test` 使用
  // `--configLoader bundle` 时，会把无法静态分析的相对路径解析到 `/e2e`。
  const suiteModule = pathToFileURL(path.resolve(import.meta.dirname, '../../../..', 'e2e/ide/react-runtime-spike.runtime.test.ts')).href
  await import(/* @vite-ignore */ suiteModule)
  return { ...hooks, cleanup }
}

function createSession(): MockSession {
  return {
    reLaunch: vi.fn(async () => {}),
    evaluate: vi.fn(async () => ({ ready: true, data: { root: { cn: [] } } })),
    close: vi.fn(async () => {}),
  }
}

afterEach(() => {
  for (const module of mockedModules) {
    vi.doUnmock(module)
  }
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

it('launches one session and closes it once after successful readiness', async () => {
  const session = createSession()
  const launch = vi.fn(async () => session)
  const suite = await loadSuite(launch)
  await suite.setup!()
  expect(launch).toHaveBeenCalledOnce()
  expect(session.reLaunch).toHaveBeenCalledExactlyOnceWith('/pages/index/index')
  expect(session.evaluate).toHaveBeenCalledOnce()
  expect(session.close).not.toHaveBeenCalled()
  expect(suite.cleanup).toHaveBeenCalledOnce()

  await suite.teardown!()
  await suite.teardown!()
  expect(session.close).toHaveBeenCalledOnce()
  expect(launch).toHaveBeenCalledOnce()
})

it('fails the first readiness timeout without closing and relaunching another IDE', async () => {
  vi.useFakeTimers()
  const session = createSession()
  session.evaluate.mockResolvedValue({ ready: false })
  const launch = vi.fn(async () => session)
  const suite = await loadSuite(launch)
  const failure = Promise.resolve(suite.setup!()).catch(error => error)
  await vi.advanceTimersByTimeAsync(15_500)
  expect(await failure).toMatchObject({ message: expect.stringContaining('Timed out waiting React runtime page /pages/index/index') })
  expect(launch).toHaveBeenCalledOnce()
  expect(session.reLaunch).toHaveBeenCalledOnce()
  expect(session.close).toHaveBeenCalledOnce()
  expect(suite.cleanup).toHaveBeenCalledOnce()
  await suite.teardown!()
  expect(session.close).toHaveBeenCalledOnce()
})

it('preserves the first navigation failure after releasing its session', async () => {
  const startupFailure = new Error('first navigation failed')
  const session = createSession()
  session.reLaunch.mockRejectedValue(startupFailure)
  const launch = vi.fn(async () => session)
  const suite = await loadSuite(launch)
  await expect(suite.setup!()).rejects.toBe(startupFailure)
  expect(session.close).toHaveBeenCalledOnce()
  expect(launch).toHaveBeenCalledOnce()
  expect(suite.cleanup).toHaveBeenCalledOnce()
  await suite.teardown!()
  expect(session.close).toHaveBeenCalledOnce()
})

it('preserves startup and cleanup failures together and refuses another launch', async () => {
  const startupFailure = new Error('first navigation failed')
  const cleanupFailure = new Error('window destruction unconfirmed')
  const session = createSession()
  session.reLaunch.mockRejectedValue(startupFailure)
  session.close.mockRejectedValue(cleanupFailure)
  const launch = vi.fn(async () => session)
  const suite = await loadSuite(launch)
  await expect(suite.setup!()).rejects.toMatchObject({
    errors: [startupFailure, cleanupFailure],
    cause: startupFailure,
  })
  expect(session.close).toHaveBeenCalledOnce()
  expect(launch).toHaveBeenCalledOnce()
  expect(suite.cleanup).toHaveBeenCalledOnce()
})

it('propagates afterAll close failure and clears the session reference', async () => {
  const cleanupFailure = new Error('snapshot removal failed')
  const session = createSession()
  session.close.mockRejectedValue(cleanupFailure)
  const launch = vi.fn(async () => session)
  const suite = await loadSuite(launch)
  await suite.setup!()
  await expect(suite.teardown!()).rejects.toBe(cleanupFailure)
  await suite.teardown!()
  expect(session.close).toHaveBeenCalledOnce()
  expect(launch).toHaveBeenCalledOnce()
})

it('keeps headless teardown errors visible without invoking IDE cleanup', async () => {
  const cleanupFailure = new Error('headless unload failed')
  const session = createSession()
  session.close.mockRejectedValue(cleanupFailure)
  const suite = await loadSuite(async () => session, 'headless')
  await suite.setup!()
  await expect(suite.teardown!()).rejects.toBe(cleanupFailure)
  expect(suite.cleanup).not.toHaveBeenCalled()
})

it('preserves a rejected launch without attempting unrelated session cleanup', async () => {
  const startupFailure = new Error('launch receipt missing')
  const launch = vi.fn(async () => {
    throw startupFailure
  })
  const suite = await loadSuite(launch)
  await expect(suite.setup!()).rejects.toBe(startupFailure)
  await suite.teardown!()
  expect(launch).toHaveBeenCalledOnce()
  expect(suite.cleanup).toHaveBeenCalledOnce()
})
