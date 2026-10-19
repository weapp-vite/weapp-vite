import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEMPLATE_DEV_OPEN_CASES } from '../e2e/ide/template-dev-open-cases'
import { createDevProcessEnv } from '../e2e/utils/dev-process-env'
import { DEVTOOLS_SELECTION_ENV_KEYS, selectWechatE2EInstallation } from '../e2e/utils/devtoolsCli'
import { E2E_TARGET_FILE_ENV } from '../e2e/utils/vitestTargetFile'

const templateCase = TEMPLATE_DEV_OPEN_CASES[0]!

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  disconnect: vi.fn(),
  execa: vi.fn(),
  login: vi.fn(),
  resolveTarget: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('execa', () => ({ execa: mocks.execa }))
vi.mock('weapp-ide-cli', () => ({ resolveWechatDevtoolsTarget: mocks.resolveTarget }))
vi.mock('../packages/devtools-runtime/src/lease/machine', () => ({
  withMachineE2ELease: async (run: () => Promise<void>) => await run(),
}))
vi.mock('../e2e/utils/automator', () => ({ assertDevtoolsLoggedIn: mocks.login }))
vi.mock('../e2e/utils/dev-process', () => ({
  cleanupTrackedDevProcesses: mocks.cleanup,
  startDevProcess: mocks.start,
}))
vi.mock('../e2e/utils/ide-devtools-cleanup', () => ({ cleanupResidualIdeProcesses: mocks.cleanup }))
vi.mock('../e2e/utils/opened-automator', () => ({
  waitForOpenedAutomator: async () => ({ miniProgram: { disconnect: mocks.disconnect } }),
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  for (const key of DEVTOOLS_SELECTION_ENV_KEYS) {
    vi.stubEnv(key, undefined)
  }
  vi.stubEnv('WEAPP_VITE_E2E_TEMPLATE', templateCase.name)
  vi.stubEnv(E2E_TARGET_FILE_ENV, undefined)
  vi.stubEnv('WEAPP_VITE_E2E_SKIP_DEVTOOLS_LOGIN_CHECK', '1')
  mocks.execa.mockResolvedValue({ exitCode: 0 })
  mocks.stop.mockResolvedValue(undefined)
  mocks.start.mockReturnValue({ waitFor: async (task: Promise<unknown>) => await task, stop: mocks.stop })
})
afterEach(() => vi.unstubAllEnvs())

describe('template dev-open selection environment', () => {
  it.each([' selected stable cli ', String.raw` C:\Program Files\腾讯\微信开发者工具\cli.bat `])('fixes the nested template dev process to %s without login preflight', async (cliPath) => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', cliPath)

    await import('../e2e/scripts/run-template-dev-open-suite')

    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.start).toHaveBeenCalledTimes(1)
    expect(mocks.start.mock.calls[0]![0]).toBe('pnpm')
    expect(mocks.start.mock.calls[0]![1]).toEqual(expect.arrayContaining(['exec', 'wv', 'dev', '-o']))
    expect(mocks.start.mock.calls[0]![2].cwd).toBe(templateCase.root)
    const childEnv = mocks.start.mock.calls[0]![2].env as NodeJS.ProcessEnv
    expect(childEnv.WEAPP_IDE_CLI_PATH).toBe(cliPath.trim())
    expect(childEnv.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH).toBeUndefined()
    expect(mocks.resolveTarget).not.toHaveBeenCalled()
    expect(mocks.stop).toHaveBeenCalledTimes(1)
    expect(mocks.execa).toHaveBeenCalledOnce()
    expect(mocks.execa.mock.calls[0]![2].env.WEAPP_VITE_E2E_TEMPLATE).toBe(templateCase.name)
  })

  it('rejects an unknown template filter before touching IDE resources', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_TEMPLATE', 'missing-template-dev-open-case')

    await expect(import('../e2e/scripts/run-template-dev-open-suite'))
      .rejects
      .toThrow('Unknown template dev:open case: missing-template-dev-open-case')

    for (const action of [mocks.cleanup, mocks.login, mocks.start, mocks.execa]) {
      expect(action).not.toHaveBeenCalled()
    }
  })

  it.each([
    [{}, false],
    [{ keepE2EEnv: true }, true],
    [{ stripE2EEnv: false }, true],
    [{ keepE2EEnv: false, stripE2EEnv: true }, false],
  ] as const)('publishes selection while respecting keep/strip options %j', (options, keep) => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', ' selected-cli ')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'inherited-other-cli')
    vi.stubEnv('WEAPP_VITE_E2E_TASK_FILTER', 'template')
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', 'lease-token')
    vi.stubEnv('WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST', '1')

    const childEnv = createDevProcessEnv(options)

    expect(childEnv.WEAPP_IDE_CLI_PATH).toBe('selected-cli')
    expect(childEnv.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST).toBe('1')
    expect(childEnv.WEAPP_VITE_E2E_TASK_FILTER).toBe(keep ? 'template' : undefined)
    expect(childEnv.WEAPP_VITE_E2E_MACHINE_LEASE).toBe('lease-token')
    expect(process.env.WEAPP_IDE_CLI_PATH).toBe('inherited-other-cli')
  })

  it.each(['CHANNEL', 'VERSION'])('rejects conflicting E2E %s values before spawning a child', (key) => {
    vi.stubEnv(`WEAPP_VITE_E2E_DEVTOOLS_${key}`, key === 'CHANNEL' ? 'stable' : '2.02.1')
    vi.stubEnv(`WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_${key}`, key === 'CHANNEL' ? 'nightly' : '2.02.2')
    expect(() => createDevProcessEnv()).toThrow('Conflicting E2E DevTools')
    expect(mocks.resolveTarget).not.toHaveBeenCalled()
  })

  it('publishes the same resolved installation as the existing selector', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', ' selected-cli ')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'inherited-other-cli')
    vi.stubEnv('WEAPP_IDE_DEVTOOLS_CHANNEL', 'nightly')
    vi.stubEnv('WEAPP_IDE_DEVTOOLS_VERSION', '2.02.1')
    mocks.resolveTarget.mockResolvedValue({ cliPath: 'resolved-selected-cli' })

    const target = await selectWechatE2EInstallation()
    const childEnv = createDevProcessEnv()

    expect(mocks.resolveTarget).toHaveBeenCalledWith({ cliPath: 'selected-cli' })
    expect(childEnv.WEAPP_IDE_CLI_PATH).toBe(target.cliPath)
    expect(childEnv.WEAPP_IDE_DEVTOOLS_CHANNEL).toBeUndefined()
    expect(childEnv.WEAPP_IDE_DEVTOOLS_VERSION).toBeUndefined()
  })

  it.each(['DEVTOOLS', 'ACCEPTED_DEVTOOLS'])('uses the shared %s channel/version selection before inherited public values', async (prefix) => {
    vi.stubEnv(`WEAPP_VITE_E2E_${prefix}_CHANNEL`, ' stable ')
    vi.stubEnv(`WEAPP_VITE_E2E_${prefix}_VERSION`, ' 2.02.3 ')
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'inherited-other-cli')
    vi.stubEnv('WEAPP_IDE_DEVTOOLS_CHANNEL', 'nightly')
    mocks.resolveTarget.mockResolvedValue({ cliPath: 'resolved-selected-cli' })

    const beforeSelection = createDevProcessEnv()
    await selectWechatE2EInstallation()
    const afterSelection = createDevProcessEnv()

    expect(beforeSelection.WEAPP_IDE_CLI_PATH).toBeUndefined()
    expect(beforeSelection.WEAPP_IDE_DEVTOOLS_CHANNEL).toBe('stable')
    expect(beforeSelection.WEAPP_IDE_DEVTOOLS_VERSION).toBe('2.02.3')
    expect(mocks.resolveTarget).toHaveBeenCalledWith({ cliPath: undefined, devtoolsChannel: 'stable', devtoolsVersion: '2.02.3' })
    expect(afterSelection.WEAPP_IDE_CLI_PATH).toBe('resolved-selected-cli')
    expect(afterSelection.WEAPP_IDE_DEVTOOLS_CHANNEL).toBe('stable')
    expect(afterSelection.WEAPP_IDE_DEVTOOLS_VERSION).toBe('2.02.3')
  })

  it('preserves inherited public constraints when E2E selection is absent', () => {
    vi.stubEnv('WEAPP_IDE_CLI_PATH', 'inherited-cli')
    vi.stubEnv('WEAPP_IDE_DEVTOOLS_CHANNEL', 'stable')
    vi.stubEnv('WEAPP_IDE_DEVTOOLS_VERSION', '2.02.3')
    const childEnv = createDevProcessEnv()
    expect(childEnv.WEAPP_IDE_CLI_PATH).toBe('inherited-cli')
    expect(childEnv.WEAPP_IDE_DEVTOOLS_CHANNEL).toBe('stable')
    expect(childEnv.WEAPP_IDE_DEVTOOLS_VERSION).toBe('2.02.3')
  })
})
