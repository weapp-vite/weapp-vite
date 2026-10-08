import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureWindowsProcessRows } from '../testSupport/windowsProcessRows'
import { createDevProcessCleanup } from './index'
import { captureDevProcessTree, isDevProcessAlive, UnconfirmedDevProcessTreeError } from './processes'

const filesystem = vi.hoisted(() => ({ readFile: vi.fn(), readlink: vi.fn(), readdir: vi.fn() }))
const execute = vi.hoisted(() => vi.fn())
vi.mock('node:fs/promises', () => ({ default: filesystem }))
vi.mock('execa', () => ({ execa: execute }))

interface ProcessStat {
  pid: number
  ppid: number
  started: string
}

function mockLinuxSnapshot() {
  const entries = new Map<number, ProcessStat>([
    [61, { pid: 61, ppid: 41, started: '100' }],
    [62, { pid: 62, ppid: 61, started: '200' }],
    [71, { pid: 71, ppid: 21, started: '300' }],
  ])
  const reads = new Map<number, number>()
  const fixture = {
    entries,
    afterSnapshot: undefined as ((pid: number) => void) | undefined,
  }
  filesystem.readdir.mockImplementation(async (directory) => {
    if (directory !== '/proc') {
      throw new Error('Unexpected process directory')
    }
    return [...entries.keys()].map(String)
  })
  filesystem.readFile.mockImplementation(async (file) => {
    if (file === '/proc/sys/kernel/random/boot_id') {
      return 'fixture-boot\n'
    }
    const match = /^\/proc\/(\d+)\/stat$/.exec(String(file))
    if (!match) {
      throw new Error('Unexpected process stat path')
    }
    const pid = Number(match[1])
    const entry = entries.get(pid)
    if (!entry) {
      throw Object.assign(new Error('Process exited'), { code: 'ENOENT' })
    }
    const fields = Array.from({ length: 20 }).fill('0')
    fields[0] = 'S'
    fields[1] = String(entry.ppid)
    fields[19] = entry.started
    const stat = `${pid} (node (fixture)) ${fields.join(' ')}`
    const count = reads.get(pid) ?? 0
    reads.set(pid, count + 1)
    if (count === 0) {
      fixture.afterSnapshot?.(pid)
    }
    return stat
  })
  filesystem.readlink.mockImplementation(async (file) => {
    if (!/^\/proc\/\d+\/exe$/.test(String(file))) {
      throw new Error('Unexpected process executable path')
    }
    return path.resolve('fixture-node')
  })
  return fixture
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
})

afterEach(() => vi.restoreAllMocks())

describe('dev process snapshot identity', () => {
  it('uses the same Windows provider to recheck only a reachable candidate with missing identity', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const root = { ProcessId: 61, ParentProcessId: 1, Started: '2026-10-08T00:00:00.0000200Z', ExecutablePath: 'fixture-node.exe' }
    const child = { ProcessId: 62, ParentProcessId: 61, Started: '2026-10-08T00:00:00.0000300Z', ExecutablePath: 'fixture-node.exe' }
    const unrelated = { ProcessId: 71, ParentProcessId: 1, Started: null, ExecutablePath: null }
    execute.mockResolvedValueOnce({ exitCode: 0, stdout: fixtureWindowsProcessRows([root, { ...child, ExecutablePath: null }, unrelated]) })
      .mockResolvedValueOnce({ exitCode: 0, stdout: fixtureWindowsProcessRows([child]) })
    expect(await captureDevProcessTree(61, () => true)).toEqual([
      { pid: 62, executable: 'fixture-node.exe', started: child.Started },
      { pid: 61, executable: 'fixture-node.exe', started: root.Started },
    ])
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls.every(([command]) => command === 'powershell.exe')).toBe(true)
    expect(execute.mock.calls[1]![1].at(-1)).toContain('-Filter \'ProcessId=62\'')
  })

  it('preserves a traced Windows inspection timeout before any owned process is signalled', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '1')
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
    const disconnect = vi.fn(() => false)
    const stderr = `WEAPP_DEV_QUERY_V1|script|begin|0.000|\r\nWEAPP_DEV_QUERY_V1|query|begin|1.250|\r\n${'private-provider-detail\n'.repeat(1_000)}`
    execute.mockResolvedValueOnce({
      exitCode: undefined,
      signal: 'SIGTERM',
      timedOut: true,
      stdout: '',
      stderr,
    })
    const cleanup = createDevProcessCleanup({ pid: 61, isRootHeld: () => true, disconnectRoot: disconnect, settledExit: Promise.resolve() })
    try {
      await expect(cleanup(0)).rejects.toMatchObject({ message: 'Dev process inspection failed: exitCode=none, signal=SIGTERM, timedOut=true.' })
      expect(execute).toHaveBeenCalledOnce()
      expect(execute.mock.calls[0]![0]).toBe('powershell.exe')
      expect(execute.mock.calls[0]![2]).toMatchObject({ timeout: 10_000, reject: false, windowsHide: true })
      expect(kill).not.toHaveBeenCalled()
      expect(disconnect).not.toHaveBeenCalled()
      const diagnostic = output.mock.calls.map(([chunk]) => String(chunk)).find(line => line.startsWith('[e2e-cleanup-query] '))
      expect(diagnostic).toBeDefined()
      expect(diagnostic).not.toContain('private-provider-detail')
      expect(diagnostic!.length).toBeLessThan(512)
      expect(JSON.parse(diagnostic!.slice('[e2e-cleanup-query] '.length)) as unknown).toEqual({
        query: 'snapshot',
        transport: 'rows',
        exitCode: null,
        timedOut: true,
        stdoutCharacters: 0,
        stderrCharacters: stderr.length,
        stderrTruncated: true,
        rawMarkerCount: 2,
        scriptBeginReceived: true,
        markers: [{ stage: 'script', event: 'begin', elapsedMs: 0 }, { stage: 'query', event: 'begin', elapsedMs: 1.25 }],
      })
    }
    finally {
      vi.unstubAllEnvs()
    }
  })

  it.each([undefined, '1'])('preserves Windows identity with the same default transport when trace=%s', async (trace) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', trace)
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const root = { ProcessId: 61, ParentProcessId: 1, Started: '2026-10-08T00:00:00.0000200Z', ExecutablePath: '节点 with space.exe' }
    const stdout = fixtureWindowsProcessRows([root])
    execute.mockResolvedValueOnce({ exitCode: 0, stdout })
    try {
      expect(await captureDevProcessTree(61, () => true)).toEqual([{ pid: 61, executable: root.ExecutablePath, started: root.Started }])
      expect(execute).toHaveBeenCalledOnce()
      expect(execute.mock.calls[0]![0]).toBe('powershell.exe')
      expect(execute.mock.calls[0]![2]).toEqual({ timeout: 10_000, reject: false, windowsHide: true })
    }
    finally {
      vi.unstubAllEnvs()
    }
  })

  it.each(['', '[]', 'WEAPP_DEV_PROCESS_ROWS_V1\n61\t1\t\t'])('rejects missing or incomplete Windows snapshots without signalling a process: %j', async (stdout) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    execute.mockResolvedValueOnce({ exitCode: 0, stdout })
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
    await expect(captureDevProcessTree(61, () => true)).rejects.toThrow('Windows process row')
    expect(execute).toHaveBeenCalledOnce()
    expect(kill).not.toHaveBeenCalled()
  })

  it('binds Linux parent relations to boot identity and stat start ticks', async () => {
    mockLinuxSnapshot()
    expect(await captureDevProcessTree(61, () => true)).toEqual([
      { pid: 62, executable: path.resolve('fixture-node'), started: 'fixture-boot:200' },
      { pid: 61, executable: path.resolve('fixture-node'), started: 'fixture-boot:100' },
    ])
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects a reused Linux PID even when its numeric parent relation stays the same', async () => {
    const fixture = mockLinuxSnapshot()
    fixture.afterSnapshot = (pid) => {
      if (pid === 62) {
        fixture.entries.set(62, { pid: 62, ppid: 61, started: '999' })
      }
    }
    await expect(captureDevProcessTree(61, () => true)).rejects.toThrow('could not be verified')
  })

  it('rejects unavailable Linux boot identity instead of treating the tree as empty', async () => {
    mockLinuxSnapshot()
    filesystem.readFile.mockRejectedValueOnce(Object.assign(new Error('Boot identity denied'), { code: 'EACCES' }))
    await expect(captureDevProcessTree(61, () => true)).rejects.toThrow('Boot identity denied')
  })

  it.each([true, false])('retains failed inspection candidates when root exits during inspection=%s', async (exitsDuringInspection) => {
    const fixture = mockLinuxSnapshot()
    let rootHeld = true
    let settleRoot!: () => void
    const settledExit = new Promise<void>((resolve) => {
      settleRoot = resolve
    })
    const exitRoot = () => {
      rootHeld = false
      settleRoot()
    }
    const cause = Object.assign(new Error('Identity inspection denied'), { code: 'EACCES' })
    filesystem.readlink.mockImplementationOnce(async () => {
      if (exitsDuringInspection) {
        exitRoot()
      }
      throw cause
    })
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
    const cleanup = createDevProcessCleanup({ pid: 61, isRootHeld: () => rootHeld, disconnectRoot: () => false, settledExit })
    const first = cleanup(0)
    await expect(first).rejects.toBeInstanceOf(UnconfirmedDevProcessTreeError)
    await expect(first).rejects.toMatchObject({ pids: [62], cause })
    exitRoot()
    await expect(cleanup(0)).rejects.toMatchObject({ pids: [62], cause })
    expect(kill.mock.calls.filter(([, signal]) => signal !== 0)).toEqual([])
    fixture.entries.delete(62)
    await expect(cleanup(0)).resolves.toBeUndefined()
  })

  it('distinguishes ESRCH from failed process-existence probes', () => {
    const kill = vi.spyOn(process, 'kill')
    kill.mockImplementationOnce(() => {
      throw Object.assign(new Error('Process exited'), { code: 'ESRCH' })
    })
    expect(isDevProcessAlive(61)).toBe(false)
    kill.mockImplementationOnce(() => {
      throw Object.assign(new Error('Signal denied'), { code: 'EPERM' })
    })
    expect(() => isDevProcessAlive(61)).toThrow('Signal denied')
  })
})
