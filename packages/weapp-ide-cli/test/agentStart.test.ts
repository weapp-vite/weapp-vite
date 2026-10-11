import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startWechatIdeAgent } from '../src/cli/agentStart'

const execute = vi.hoisted(() => vi.fn())
const resolveTarget = vi.hoisted(() => vi.fn())
const assertHost = vi.hoisted(() => vi.fn())
const withMachineLease = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
vi.mock('../src/devtoolsTarget', () => ({ resolveWechatDevtoolsTarget: resolveTarget, assertWechatDevtoolsHost: assertHost }))
vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: withMachineLease }))

const target = { cliPath: 'selected-cli', installationId: 'selected', appPath: 'selected-app', profileDir: 'selected-profile' }
const options = { projectPath: 'fixtures/agent project', port: 19201, target }
const response = { command: 'agent-start', status: 'ok', autoPort: options.port, openedProjectWindow: true, version: '2.02.2608070' }

describe('startWechatIdeAgent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    withMachineLease.mockImplementation(async (run: () => Promise<unknown>) => await run())
    resolveTarget.mockResolvedValue(target)
    assertHost.mockResolvedValue(undefined)
    execute.mockResolvedValue({ stdout: JSON.stringify(response) })
  })

  it('runs the official agent command against the selected installation under the lease', async () => {
    let held = false
    withMachineLease.mockImplementation(async (run: () => Promise<unknown>) => {
      held = true
      try {
        return await run()
      }
      finally {
        held = false
      }
    })
    resolveTarget.mockImplementation(async () => {
      expect(held).toBe(true)
      return target
    })
    assertHost.mockImplementation(async () => {
      expect(held).toBe(true)
    })
    execute.mockImplementation(async () => {
      expect(held).toBe(true)
      return { stdout: JSON.stringify(response) }
    })

    await expect(startWechatIdeAgent({ ...options, cliPath: target.cliPath, trustProject: true, timeout: 4000 })).resolves.toEqual({
      autoPort: options.port,
      openedProjectWindow: true,
      version: response.version,
    })

    expect(resolveTarget).toHaveBeenCalledExactlyOnceWith({ target, cliPath: target.cliPath })
    expect(assertHost).toHaveBeenCalledExactlyOnceWith(target, expect.objectContaining({ timeout: 4000 }))
    expect(execute).toHaveBeenCalledExactlyOnceWith(target.cliPath, [
      'agent',
      'start',
      '--project',
      path.resolve(options.projectPath),
      '--auto-port',
      String(options.port),
      '--trust-project',
    ], expect.objectContaining({ timeout: 4000, killDescendants: false }))
    expect(held).toBe(false)
  })

  it('does not enable project trust unless explicitly requested', async () => {
    await startWechatIdeAgent(options)
    expect(execute.mock.calls[0]![1]).toEqual([
      'agent',
      'start',
      '--project',
      path.resolve(options.projectPath),
      '--auto-port',
      String(options.port),
    ])
    expect(execute.mock.calls[0]![2].timeout).toBe(120_000)
  })

  it.each([true, false])('preserves the official window ownership result %s with surrounding logs', async (openedProjectWindow) => {
    execute.mockResolvedValue({ stdout: `CLI ready\r\n{CLI diagnostics}\r\n\u001B[32m${JSON.stringify({ ...response, openedProjectWindow, diagnostic: 'literal } and \\"quoted\\" { braces' }, null, 2)}\u001B[0m\r\nCommand finished\r\n` })
    await expect(startWechatIdeAgent(options)).resolves.toEqual({ autoPort: options.port, openedProjectWindow, version: response.version })
  })

  it('ignores unrelated JSON diagnostics without reading nested response-like objects', async () => {
    execute.mockResolvedValue({ stdout: `${JSON.stringify({ detail: { ...response, openedProjectWindow: false } })}\n${JSON.stringify(response)}\n` })
    await expect(startWechatIdeAgent(options)).resolves.toEqual({ autoPort: options.port, openedProjectWindow: true, version: response.version })
  })

  it.each([
    '',
    'agent start succeeded',
    '{"command":"agent-start",',
    JSON.stringify({ ...response, command: 'auto' }),
    JSON.stringify({ ...response, status: 'error' }),
    JSON.stringify({ ...response, autoPort: String(options.port) }),
    JSON.stringify({ ...response, autoPort: options.port + 1 }),
    JSON.stringify({ ...response, openedProjectWindow: 'true' }),
    JSON.stringify({ ...response, openedProjectWindow: undefined }),
    JSON.stringify({ ...response, version: '' }),
    JSON.stringify({ ...response, version: 2 }),
    JSON.stringify({ ...response, version: undefined }),
    JSON.stringify([response]),
    JSON.stringify([response], null, 2),
    `${JSON.stringify(response)}\n${JSON.stringify({ ...response, openedProjectWindow: false })}`,
  ])('rejects incomplete or ambiguous successful output: %j', async (stdout) => {
    execute.mockResolvedValue({ stdout })
    await expect(startWechatIdeAgent(options)).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_AGENT_START_INVALID_RESPONSE', stdout })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it.each([
    { projectPath: '' },
    { projectPath: '   ' },
    { cliPath: '' },
    { cliPath: '   ' },
    { port: 0 },
    { port: -1 },
    { port: 65536 },
    { port: 1.5 },
    { port: Number.NaN },
    { timeout: 0 },
    { timeout: -1 },
    { timeout: Number.POSITIVE_INFINITY },
  ])('rejects invalid options before acquiring a lease: %j', async (override) => {
    await expect(startWechatIdeAgent({ ...options, ...override })).rejects.toBeInstanceOf(TypeError)
    expect(withMachineLease).not.toHaveBeenCalled()
    expect(resolveTarget).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it.each(['lease', 'selection', 'host'] as const)('preserves %s failures without starting a command', async (stage) => {
    const failure = new Error(`${stage} failed`)
    const mock = { lease: withMachineLease, selection: resolveTarget, host: assertHost }[stage]
    mock.mockRejectedValue(failure)
    await expect(startWechatIdeAgent(options)).rejects.toBe(failure)
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    Object.assign(new Error('CLI timed out'), { timedOut: true }),
    Object.assign(new Error('port already used by another automation session'), { exitCode: 1, stdout: '{"status":"error"}' }),
  ])('preserves command failures and never falls back to auto: %j', async (failure) => {
    execute.mockRejectedValue(failure)
    await expect(startWechatIdeAgent(options)).rejects.toBe(failure)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('does not start an already cancelled request', async () => {
    const reason = new Error('cancelled by caller')
    await expect(startWechatIdeAgent({ ...options, signal: AbortSignal.abort(reason) })).rejects.toBe(reason)
    expect(withMachineLease).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it.each(['selection', 'host'] as const)('does not launch after cancellation during %s', async (stage) => {
    const controller = new AbortController()
    const reason = new Error('cancelled before launch')
    const mock = stage === 'selection' ? resolveTarget : assertHost
    mock.mockImplementation(async () => {
      controller.abort(reason)
      return target
    })
    await expect(startWechatIdeAgent({ ...options, signal: controller.signal })).rejects.toBe(reason)
    expect(execute).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)('waits for the command to settle by %s on cancellation', async (outcome) => {
    const controller = new AbortController()
    const reason = new Error('cancelled while starting')
    const command = Promise.withResolvers<{ stdout: string }>()
    const started = Promise.withResolvers<void>()
    execute.mockImplementation(() => {
      started.resolve()
      return command.promise
    })
    let settled = false
    const pending = startWechatIdeAgent({ ...options, signal: controller.signal })
    const assertion = expect(pending).rejects.toBe(reason)
    void pending.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await started.promise
    expect(execute.mock.calls[0]![2].cancelSignal).toBe(controller.signal)
    controller.abort(reason)
    await Promise.resolve()
    expect(settled).toBe(false)
    if (outcome === 'resolve') {
      command.resolve({ stdout: JSON.stringify(response) })
    }
    else {
      command.reject(new Error('process cancelled'))
    }
    await assertion
  })

  it('records a complete window receipt before reporting cancellation', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled after the window opened')
    execute.mockImplementation(async () => {
      controller.abort(reason)
      return { stdout: JSON.stringify(response) }
    })
    const confirmation = Promise.withResolvers<void>()
    const confirming = Promise.withResolvers<void>()
    const onStarted = vi.fn(() => {
      confirming.resolve()
      return confirmation.promise
    })
    let settled = false
    const pending = startWechatIdeAgent({ ...options, signal: controller.signal, onStarted })
    const assertion = expect(pending).rejects.toBe(reason)
    void pending.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await confirming.promise
    expect(onStarted).toHaveBeenCalledExactlyOnceWith({ autoPort: options.port, openedProjectWindow: true, version: response.version })
    expect(settled).toBe(false)
    confirmation.resolve()
    await assertion
  })

  it('does not return success before the window receipt is durably recorded', async () => {
    const failure = new Error('ownership journal could not be written')
    await expect(startWechatIdeAgent({ ...options, onStarted: async () => {
      throw failure
    } })).rejects.toBe(failure)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it.each(['cancel', 'timeout', 'exit'] as const)('records a complete receipt from a rejected %s command before preserving its failure', async (outcome) => {
    const controller = new AbortController()
    const reason = new Error('cancelled after receipt stdout')
    const failure = Object.assign(new Error('command failed after receipt stdout'), {
      stdout: `${JSON.stringify(response)}\n`,
      ...(outcome === 'cancel' ? { isCanceled: true } : outcome === 'timeout' ? { timedOut: true } : { exitCode: 1 }),
    })
    execute.mockImplementation(async () => {
      if (outcome === 'cancel') {
        controller.abort(reason)
      }
      throw failure
    })
    const confirming = Promise.withResolvers<void>()
    const confirmed = Promise.withResolvers<void>()
    const onStarted = vi.fn(() => {
      confirming.resolve()
      return confirmed.promise
    })
    let settled = false
    const pending = startWechatIdeAgent({ ...options, signal: controller.signal, onStarted })
    const assertion = expect(pending).rejects.toBe(outcome === 'cancel' ? reason : failure)
    void pending.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await confirming.promise
    expect(onStarted).toHaveBeenCalledExactlyOnceWith({ autoPort: options.port, openedProjectWindow: true, version: response.version })
    expect(settled).toBe(false)
    confirmed.resolve()
    await assertion
    expect(execute).toHaveBeenCalledOnce()
  })

  it('retains a borrowed receipt from a rejected command without claiming a new window', async () => {
    const failure = Object.assign(new Error('command exited after receipt'), { exitCode: 1, stdout: JSON.stringify({ ...response, openedProjectWindow: false }) })
    const onStarted = vi.fn()
    execute.mockRejectedValue(failure)
    await expect(startWechatIdeAgent({ ...options, onStarted })).rejects.toBe(failure)
    expect(onStarted).toHaveBeenCalledExactlyOnceWith({ autoPort: options.port, openedProjectWindow: false, version: response.version })
  })

  it('retains both the command failure and failed receipt persistence', async () => {
    const failure = Object.assign(new Error('command exited after receipt'), { exitCode: 1, stdout: JSON.stringify(response) })
    const confirmationError = new Error('journal write failed')
    execute.mockRejectedValue(failure)
    await expect(startWechatIdeAgent({ ...options, onStarted: async () => {
      throw confirmationError
    } })).rejects.toMatchObject({ errors: [failure, confirmationError], cause: failure })
  })

  it.each([
    undefined,
    '',
    '{"command":"agent-start",',
    JSON.stringify({ ...response, status: 'error' }),
    JSON.stringify({ ...response, autoPort: options.port + 1 }),
    JSON.stringify([response]),
    JSON.stringify({ nested: response }),
    `${JSON.stringify(response)}\n${JSON.stringify({ ...response, openedProjectWindow: false })}`,
  ])('does not infer ownership from invalid rejected-command output: %j', async (stdout) => {
    const failure = Object.assign(new Error('command failed without a unique receipt'), { exitCode: 1, stdout })
    const onStarted = vi.fn()
    execute.mockRejectedValue(failure)
    await expect(startWechatIdeAgent({ ...options, onStarted })).rejects.toBe(failure)
    expect(onStarted).not.toHaveBeenCalled()
  })
})
