import { beforeEach, describe, expect, it, vi } from 'vitest'

const execute = vi.hoisted(() => vi.fn())
const logger = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }))
vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: async (run: () => Promise<unknown>) => run() }))
vi.mock('../src/utils', () => ({ execute }))
vi.mock('../src/devtoolsTarget', () => ({
  resolveWechatDevtoolsTarget: async ({ cliPath }: { cliPath: string }) => ({ cliPath }),
  assertWechatDevtoolsHost: async () => {},
}))
vi.mock('../src/cli/inputCoordinator', () => ({
  runWithSuspendedSharedInput: async (run: () => Promise<unknown>) => run(),
  waitForExclusiveKeypress: vi.fn(),
}))
vi.mock('../src/logger', async importOriginal => ({
  ...await importOriginal<typeof import('../src/logger')>(),
  default: logger,
}))

describe('official CLI login classification', () => {
  beforeEach(() => {
    execute.mockReset()
    for (const method of Object.values(logger)) {
      method.mockReset()
    }
  })

  it('preserves a generic project-path failure without login retry or wrapping', async () => {
    const { runWechatCliWithRetry } = await import('../src/cli/run-login')
    const original = Object.assign(new Error('Error: 项目路径不存在 (code 10)'), {
      stderr: '[error] { code: 10, error: "项目路径不存在" }',
      exitCode: 1,
    })
    execute.mockRejectedValue(original)

    await expect(runWechatCliWithRetry('fixture-cli', ['open', '--project', 'fixture', '--non-interactive'])).rejects.toBe(original)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it.each(['需要重新登录 (code 10)', 'Login again is required (code 13)'])('retains non-interactive login failure behavior: %s', async (message) => {
    const { runWechatCliWithRetry } = await import('../src/cli/run-login')
    execute.mockRejectedValue(new Error(message))

    await expect(runWechatCliWithRetry('fixture-cli', ['open', '--non-interactive'])).rejects.toMatchObject({
      name: 'WechatIdeLoginRequiredError',
      code: 10,
      exitCode: 10,
    })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
