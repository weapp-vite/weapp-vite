import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryWechatIdeLogin } from '../src/cli/loginQuery'

const execute = vi.hoisted(() => vi.fn())
vi.mock('../src/utils', () => ({ execute }))

describe('native login query evidence', () => {
  beforeEach(() => vi.resetAllMocks())

  it.each([true, false])('reads explicit login %s instead of inferring it from exit status', async (login) => {
    execute.mockResolvedValue({ stdout: `CLI diagnostic\r\n\u001B[32m${JSON.stringify({ login })}\u001B[0m\r\n` })
    await expect(queryWechatIdeLogin('selected-cli')).resolves.toEqual({ status: 'success', login })
    expect(execute).toHaveBeenCalledExactlyOnceWith('selected-cli', ['islogin'], { pipeStdout: false, pipeStderr: false, timeout: 3_000 })
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
