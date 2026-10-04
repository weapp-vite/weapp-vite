import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryWechatIdeLogin } from '../src/cli/loginQuery'

const withMachineLease = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: withMachineLease }))

const execute = vi.hoisted(() => vi.fn())
const resolveTarget = vi.hoisted(() => vi.fn())
const assertHost = vi.hoisted(() => vi.fn())
vi.mock('../src/utils', () => ({ execute }))
vi.mock('../src/devtoolsTarget', () => ({ resolveWechatDevtoolsTarget: resolveTarget, assertWechatDevtoolsHost: assertHost }))

describe('native login query evidence', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    withMachineLease.mockImplementation(async (run: () => Promise<unknown>) => await run())
    resolveTarget.mockImplementation(async ({ cliPath }) => ({ cliPath, installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile' }))
    assertHost.mockResolvedValue(undefined)
  })
  afterEach(() => vi.useRealTimers())

  it('reports an occupied machine lease without querying or changing the host', async () => {
    const runtime = await vi.importActual<typeof import('@weapp-vite/devtools-runtime')>('@weapp-vite/devtools-runtime')
    const stateDirectory = await mkdtemp(path.join(tmpdir(), 'weapp-login-lease-'))
    const owner = await runtime.acquireMachineE2ELease({ stateDirectory, env: {} })
    try {
      withMachineLease.mockImplementation(run => runtime.withMachineE2ELease(run, { stateDirectory, env: {} }))
      await expect(queryWechatIdeLogin('selected-cli')).resolves.toEqual({ status: 'unknown', reason: 'runtime-busy' })
      expect(resolveTarget).not.toHaveBeenCalled()
      expect(assertHost).not.toHaveBeenCalled()
      expect(execute).not.toHaveBeenCalled()
      expect(owner.released).toBe(false)
    }
    finally {
      await owner.release()
      await rm(stateDirectory, { recursive: true, force: true })
    }
  })

  it('does not invoke islogin while another installation owns the shared host', async () => {
    assertHost.mockRejectedValueOnce(Object.assign(new Error('different installation'), { code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' }))
    await expect(queryWechatIdeLogin('selected-cli')).resolves.toEqual({ status: 'unknown', reason: 'installation-mismatch' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('shares the query deadline with installation resolution and ignores a late selection', async () => {
    vi.useFakeTimers()
    const selection = Promise.withResolvers<unknown>()
    resolveTarget.mockReturnValueOnce(selection.promise)
    const pending = queryWechatIdeLogin('selected-cli', { timeout: 25 })
    await vi.advanceTimersByTimeAsync(25)
    expect(await pending).toEqual({ status: 'unknown', reason: 'timeout' })
    selection.resolve({ cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile' })
    await vi.advanceTimersByTimeAsync(0)
    expect(execute).not.toHaveBeenCalled()
    expect(assertHost).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves explicit cancellation and does not query a cancelled host', async () => {
    const reason = new Error('cancelled by caller')
    await expect(queryWechatIdeLogin('selected-cli', { signal: AbortSignal.abort(reason) })).rejects.toBe(reason)
    expect(resolveTarget).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([true, false])('reads explicit login %s instead of inferring it from exit status', async (login) => {
    execute.mockResolvedValue({ stdout: `CLI diagnostic\r\n\u001B[32m${JSON.stringify({ login })}\u001B[0m\r\n` })
    await expect(queryWechatIdeLogin('selected-cli')).resolves.toEqual({ status: 'success', login })
    expect(execute).toHaveBeenCalledExactlyOnceWith('selected-cli', ['islogin'], expect.objectContaining({ pipeStdout: false, pipeStderr: false, signal: expect.any(AbortSignal) }))
    expect(execute.mock.calls[0]![2].timeout).toBeLessThanOrEqual(3_000)
    expect(execute.mock.calls[0]![2].timeout).toBeGreaterThan(0)
  })

  it.each(['', 'logged in', '{"login":"false"}', '{"login":true}\n{"login":false}'])('does not treat ambiguous output as success: %j', async (stdout) => {
    execute.mockResolvedValue({ stdout })
    await expect(queryWechatIdeLogin('selected-cli')).resolves.toEqual({ status: 'unknown', reason: 'invalid-response' })
  })

  it.each([
    [Object.assign(new Error('private diagnostic'), { timedOut: true }), 'timeout'],
    [new Error('private diagnostic'), 'command-failed'],
  ])('keeps failed queries unknown without leaking raw diagnostics', async (error, reason) => {
    execute.mockRejectedValue(error)
    await expect(queryWechatIdeLogin('selected-cli', { timeout: 500 })).resolves.toEqual({ status: 'unknown', reason })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects unbounded or invalid timeout %s before execution', async (timeout) => {
    await expect(queryWechatIdeLogin('selected-cli', { timeout })).rejects.toThrow('timeout')
    expect(execute).not.toHaveBeenCalled()
  })
})
