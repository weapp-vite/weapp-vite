import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { probeDoctorRuntime } from './runtime'

const mocks = vi.hoisted(() => ({ connect: vi.fn(), login: vi.fn(), port: vi.fn() }))
vi.mock('weapp-ide-cli', () => ({ connectOpenedAutomator: mocks.connect, queryWechatIdeLogin: mocks.login, resolveProjectAutomatorPort: mocks.port }))

describe('Doctor runtime facts', () => {
  const directories: string[] = []
  let disconnect: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.port.mockReturnValue(12345)
    disconnect = vi.fn()
    mocks.connect.mockResolvedValue({
      disconnect,
      currentPage: async () => ({ path: 'pages/home?ticket=secret-ticket' }),
      toolInfo: async () => ({ version: '2.02.2608080', SDKVersion: '3.17.3', ticket: 'secret-ticket', userPath: '/private/example' }),
    })
  })
  afterEach(async () => {
    vi.useRealTimers()
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  async function cliFixture() {
    const directory = await mkdtemp(path.join(tmpdir(), 'doctor-facts-'))
    directories.push(directory)
    const cli = path.join(directory, 'cli.cmd')
    await writeFile(cli, 'fixture only; never executed', { mode: 0o700 })
    return cli
  }

  it('retains actual host versions and redacts raw tool data and route queries', async () => {
    const evidence = await probeDoctorRuntime('fixture', 'weapp')
    expect(evidence).toMatchObject({
      route: 'pages/home',
      complete: true,
      bundle: { versions: { ide: '2.02.2608080', sdk: '3.17.3' }, lastSuccessfulStage: 'current-page' },
    })
    expect(JSON.stringify(evidence)).not.toMatch(/secret-ticket|private\/example/)
    expect(mocks.login).not.toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('preserves successful tool facts when the page RPC fails', async () => {
    mocks.connect.mockResolvedValue({
      disconnect,
      toolInfo: async () => ({ version: '2.02.2608080' }),
      currentPage: async () => { throw new Error('ticket=secret-ticket') },
    })
    const evidence = await probeDoctorRuntime('fixture', 'weapp')
    expect(evidence).toMatchObject({ complete: false, bundle: { lastSuccessfulStage: 'tool-info' } })
    expect(evidence.facts).toContainEqual({ stage: 'current-page', status: 'failed', code: 'rpc-failed' })
    expect(JSON.stringify(evidence)).not.toContain('secret-ticket')
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('does not treat an empty tool response as verified host and SDK versions', async () => {
    mocks.connect.mockResolvedValue({ disconnect, toolInfo: async () => ({}), currentPage: async () => ({ path: 'pages/home' }) })
    const evidence = await probeDoctorRuntime('fixture', 'weapp')
    expect(evidence.complete).toBe(false)
    expect(evidence.facts).toContainEqual({ stage: 'tool-info', status: 'passed', code: 'snapshot-read' })
    expect(evidence.facts).toContainEqual({ stage: 'host-version', status: 'unknown', code: 'version-unavailable' })
    expect(evidence.facts).toContainEqual({ stage: 'sdk-version', status: 'unknown', code: 'version-unavailable' })
  })

  it('distinguishes a reachable login query from explicit logged-out state', async () => {
    mocks.login.mockResolvedValue({ status: 'success', login: false })
    const cliPath = await cliFixture()
    const evidence = await probeDoctorRuntime('fixture', 'weapp', undefined, { cliPath, login: true })
    expect(evidence.facts).toContainEqual({ stage: 'login-query', status: 'passed', code: 'response-received' })
    expect(evidence.facts).toContainEqual({ stage: 'login-state', status: 'failed', code: 'logged-out' })
    expect(evidence.complete).toBe(false)
    expect(JSON.stringify(evidence)).not.toContain(cliPath)
  })

  it('records a refused listener without inferring an IDE or login failure', async () => {
    const server = createServer()
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('TCP fixture address unavailable')
    }
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    const evidence = await probeDoctorRuntime('fixture', 'weapp', undefined, { servicePort: address.port })
    expect(evidence.facts).toContainEqual({ stage: 'service-listener', status: 'failed', code: 'not-listening' })
    expect(evidence.facts).toContainEqual({ stage: 'login-state', status: 'not-run', code: 'not-requested' })
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('does not execute a directory or guess a fallback CLI', async () => {
    const cliPath = path.dirname(await cliFixture())
    const evidence = await probeDoctorRuntime('fixture', 'weapp', undefined, { cliPath, login: true })
    expect(evidence.facts).toContainEqual({ stage: 'cli-executable', status: 'failed', code: 'not-executable' })
    expect(evidence.facts).toContainEqual({ stage: 'login-query', status: 'not-run', code: 'explicit-executable-required' })
    expect(evidence.complete).toBe(false)
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('keeps login state unknown when an explicit query times out', async () => {
    mocks.login.mockResolvedValue({ status: 'unknown', reason: 'timeout' })
    const evidence = await probeDoctorRuntime('fixture', 'weapp', undefined, { cliPath: await cliFixture(), login: true })
    expect(evidence.facts).toContainEqual({ stage: 'login-query', status: 'unknown', code: 'timeout' })
    expect(evidence.facts).toContainEqual({ stage: 'login-state', status: 'unknown', code: 'query-incomplete' })
    expect(evidence.complete).toBe(false)
  })

  it('requires an explicit CLI before a login query can launch native tooling', async () => {
    const evidence = await probeDoctorRuntime('fixture', 'weapp', undefined, { login: true })
    expect(evidence.complete).toBe(false)
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('disconnects a late connection without inspecting it or changing the returned report', async () => {
    vi.useFakeTimers()
    let resolve!: (value: unknown) => void
    mocks.connect.mockReturnValue(new Promise((done) => {
      resolve = done
    }))
    const pending = probeDoctorRuntime('fixture', 'weapp')
    await vi.advanceTimersByTimeAsync(3_000)
    const evidence = await pending
    const snapshot = JSON.stringify(evidence)
    expect(evidence.facts).toContainEqual({ stage: 'project-connection', status: 'failed', code: 'timeout' })
    const late = { disconnect, currentPage: vi.fn(), toolInfo: vi.fn() }
    resolve(late)
    await vi.advanceTimersByTimeAsync(0)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(late.currentPage).not.toHaveBeenCalled()
    expect(late.toolInfo).not.toHaveBeenCalled()
    expect(JSON.stringify(evidence)).toBe(snapshot)
  })

  it('keeps a timed-out page response from mutating the finished evidence', async () => {
    vi.useFakeTimers()
    let resolve!: (value: unknown) => void
    mocks.connect.mockResolvedValue({
      disconnect,
      toolInfo: async () => ({ version: '2.02.2608080' }),
      currentPage: () => new Promise((done) => {
        resolve = done
      }),
    })
    const pending = probeDoctorRuntime('fixture', 'weapp')
    await vi.advanceTimersByTimeAsync(5_000)
    const evidence = await pending
    expect(evidence.facts).toContainEqual({ stage: 'current-page', status: 'failed', code: 'timeout' })
    const snapshot = JSON.stringify(evidence)
    resolve({ path: 'pages/late?ticket=secret-ticket' })
    await vi.advanceTimersByTimeAsync(0)
    expect(JSON.stringify(evidence)).toBe(snapshot)
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('leaves the inspected TCP server listening after releasing only its own socket', async () => {
    const server = createServer(socket => socket.end())
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('TCP fixture address unavailable')
      }
      const evidence = await probeDoctorRuntime('fixture', 'weapp', undefined, { servicePort: address.port })
      expect(evidence.facts).toContainEqual({ stage: 'service-listener', status: 'passed', code: 'listening' })
      expect(server.listening).toBe(true)
      expect(evidence.bundle?.configuration.explicitServicePort).toBe(true)
    }
    finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })

  it('marks an invalid page snapshot as a failed assertion after a successful connection', async () => {
    mocks.connect.mockResolvedValue({ disconnect, toolInfo: async () => ({ version: '2.02.2608080' }), currentPage: async () => ({ path: '' }) })
    const evidence = await probeDoctorRuntime('fixture', 'weapp')
    expect(evidence.facts).toContainEqual({ stage: 'project-connection', status: 'passed', code: 'connected' })
    expect(evidence.facts).toContainEqual({ stage: 'current-page', status: 'failed', code: 'invalid-response' })
    expect(evidence.complete).toBe(false)
  })
})
