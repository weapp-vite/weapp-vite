import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readDarwinManagedProcessIdentities } from './darwinProcessIdentity'
import { readManagedProcessIdentity, sameManagedProcess } from './processIdentity'

const inspect = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: inspect }))
beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.restoreAllMocks())

interface FixtureProcess {
  started: string
  executable: string
  title: string
}

const success = (stdout: string) => ({ stdout, exitCode: 0, stderr: '' })

function createFixture() {
  const executable = path.posix.join('/', 'fixture with spaces', 'node')
  const entries = new Map<number, FixtureProcess>([
    [123, { executable, started: 'Mon Oct 5 12:30:01 2026', title: 'node' }],
    [124, { executable, started: 'Mon Oct 5 12:30:02 2026', title: 'node child' }],
  ])
  const state = {
    entries,
    afterFirstPs: undefined as (() => void) | undefined,
    afterKernel: undefined as (() => void) | undefined,
    onCommand: undefined as (() => void) | undefined,
  }
  let psCount = 0
  inspect.mockImplementation(async (command: string, args: string[]) => {
    state.onCommand?.()
    if (command === '/bin/ps') {
      expect(args[0]).toBe('-p')
      expect(args.slice(2)).toEqual(['-o', 'pid=,lstart='])
      const stdout = args[1]!.split(',').map(Number).flatMap((pid) => {
        const entry = entries.get(pid)
        return entry ? [`${pid} ${entry.started}`] : []
      }).join('\n')
      if (++psCount === 1) {
        state.afterFirstPs?.()
      }
      return { ...success(stdout), exitCode: stdout ? 0 : 1 }
    }
    if (command === '/usr/bin/osascript') {
      expect(args.slice(0, 3)).toEqual(['-l', 'JavaScript', '-e'])
      expect(args[3]).toContain('proc_pidpath')
      const value: unknown = JSON.parse(args[4]!)
      if (!Array.isArray(value) || value.some(pid => typeof pid !== 'number')) {
        throw new Error('Unexpected fixture kernel request')
      }
      const pids = value as number[]
      const stdout = JSON.stringify(pids.map(pid => ({ pid, executable: entries.get(pid)?.executable ?? null })))
      state.afterKernel?.()
      return success(stdout)
    }
    throw new Error(`Unexpected identity fixture command: ${command}`)
  })
  return state
}

describe('macOS managed process kernel identity', () => {
  it('batches the exact requested PIDs into one kernel query and two birth-time reads', async () => {
    const fixture = createFixture()
    expect(await readDarwinManagedProcessIdentities([123, 124])).toEqual(new Map([
      [123, { pid: 123, executable: fixture.entries.get(123)!.executable, started: fixture.entries.get(123)!.started }],
      [124, { pid: 124, executable: fixture.entries.get(124)!.executable, started: fixture.entries.get(124)!.started }],
    ]))
    expect(inspect.mock.calls.map(([command]) => command)).toEqual(['/bin/ps', '/usr/bin/osascript', '/bin/ps'])
    expect(inspect.mock.calls[1]![1].at(-1)).toBe('[123,124]')
  })

  it('preserves kernel executable identity when mutable process titles change', async () => {
    const fixture = createFixture()
    fixture.afterFirstPs = () => {
      fixture.entries.get(123)!.title = 'npm'
    }
    const first = await readManagedProcessIdentity(123, 'darwin')
    expect(fixture.entries.get(123)!.title).toBe('npm')
    fixture.entries.get(123)!.title = 'npm install'
    const second = await readManagedProcessIdentity(123, 'darwin')
    expect(first).toEqual({ pid: 123, executable: fixture.entries.get(123)!.executable, started: fixture.entries.get(123)!.started })
    expect(second).toEqual(first)
    expect(sameManagedProcess(first!, second!)).toBe(true)
    expect(fixture.entries.get(123)!.title).toBe('npm install')
  })

  it('continues to reject real executable drift with unchanged PID and start time', async () => {
    const fixture = createFixture()
    const first = await readManagedProcessIdentity(123, 'darwin')
    fixture.entries.get(123)!.executable = path.posix.join('/', 'another-installation', 'node')
    const second = await readManagedProcessIdentity(123, 'darwin')
    expect(first!.pid).toBe(second!.pid)
    expect(first!.started).toBe(second!.started)
    expect(sameManagedProcess(first!, second!)).toBe(false)
  })

  it('rejects PID reuse between kernel lookup and the final birth-time read', async () => {
    const fixture = createFixture()
    fixture.afterKernel = () => {
      fixture.entries.get(123)!.started = 'Mon Oct 5 12:30:09 2026'
    }
    await expect(readDarwinManagedProcessIdentities([123, 124])).rejects.toThrow('could not be verified')
    expect(inspect).toHaveBeenCalledTimes(3)
  })

  it('rejects a PID first appearing after the initial birth-time inventory', async () => {
    const fixture = createFixture()
    const child = fixture.entries.get(124)!
    fixture.entries.delete(124)
    fixture.afterKernel = () => fixture.entries.set(124, child)
    await expect(readDarwinManagedProcessIdentities([123, 124])).rejects.toThrow('could not be verified')
    expect(inspect.mock.calls[1]![1].at(-1)).toBe('[123]')
  })

  it('returns quiet pre-query exits without running kernel inspection', async () => {
    const fixture = createFixture()
    fixture.entries.clear()
    expect(await readDarwinManagedProcessIdentities([123, 124])).toEqual(new Map([[123, undefined], [124, undefined]]))
    expect(inspect).toHaveBeenCalledOnce()
  })

  it.each(['afterFirstPs', 'afterKernel'] as const)('proves an exit at %s with the final birth-time query', async (phase) => {
    const fixture = createFixture()
    fixture[phase] = () => fixture.entries.delete(123)
    expect(await readDarwinManagedProcessIdentities([123])).toEqual(new Map([[123, undefined]]))
    expect(inspect).toHaveBeenCalledTimes(3)
  })

  it.each([null, '', 'npm'])('rejects missing or non-absolute kernel paths for a live PID: %j', async (executable) => {
    createFixture()
    inspect.mockResolvedValueOnce(success('123 Mon Oct 5 12:30:01 2026'))
      .mockResolvedValueOnce(success(JSON.stringify([{ pid: 123, executable }])))
    await expect(readDarwinManagedProcessIdentities([123])).rejects.toThrow('could not be verified')
    expect(inspect).toHaveBeenCalledTimes(3)
  })

  it.each([
    { ...success(''), exitCode: 0 },
    { ...success(''), exitCode: 1, stderr: 'Permission denied' },
    { ...success(''), exitCode: 1, timedOut: true },
    { ...success(''), exitCode: 1, signal: 'SIGTERM' },
    { ...success(''), exitCode: 2 },
    success('123 unreadable'),
    success('123 Mon Oct 5 12:30:01 2026\n123 Mon Oct 5 12:30:01 2026'),
    success('999 Mon Oct 5 12:30:01 2026'),
  ])('rejects empty, partial, duplicate or foreign birth inventories: %j', async (response) => {
    createFixture()
    inspect.mockResolvedValueOnce(response)
    await expect(readDarwinManagedProcessIdentities([123])).rejects.toThrow('could not be verified')
    expect(inspect).toHaveBeenCalledOnce()
  })

  it.each([
    success('invalid'),
    success('[]'),
    { ...success('[{"pid":123,"executable":"/kernel/node"}]'), stderr: 'Permission denied' },
    { ...success('[{"pid":123,"executable":"/kernel/node"}]'), timedOut: true },
    { ...success('[{"pid":123,"executable":"/kernel/node"}]'), signal: 'SIGTERM' },
    { ...success(''), exitCode: 1 },
    { stdout: '', stderr: '', exitCode: undefined, timedOut: true, signal: 'SIGTERM' },
  ])('keeps failed kernel inspection separate from process exit: %j', async (response) => {
    createFixture()
    inspect.mockResolvedValueOnce(success('123 Mon Oct 5 12:30:01 2026'))
      .mockResolvedValueOnce(response)
    await expect(readDarwinManagedProcessIdentities([123])).rejects.toThrow()
    expect(inspect).toHaveBeenCalledTimes(2)
  })

  it.each([success(''), { ...success(''), exitCode: 1, stderr: 'Permission denied' }])('preserves a post-kernel inspection failure instead of accepting an exit: %j', async (response) => {
    createFixture()
    inspect.mockResolvedValueOnce(success('123 Mon Oct 5 12:30:01 2026'))
      .mockResolvedValueOnce(success('[{"pid":123,"executable":"/kernel/node"}]'))
      .mockResolvedValueOnce(response)
    await expect(readDarwinManagedProcessIdentities([123])).rejects.toThrow('could not be verified')
  })

  it('shares the original three-second deadline across every query', async () => {
    const fixture = createFixture()
    let elapsed = 0
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed)
    const costs = [800, 900, 500]
    fixture.onCommand = () => {
      elapsed += costs.shift()!
    }
    await readDarwinManagedProcessIdentities([123, 124])
    expect(inspect.mock.calls.map(([, , options]) => options.timeout)).toEqual([3_000, 2_200, 1_300])
  })

  it.each([1, 2, 3])('does not accept a result or dispatch another query after stage %s consumes the total deadline', async (stage) => {
    const fixture = createFixture()
    let elapsed = 0
    let count = 0
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed)
    fixture.onCommand = () => {
      if (++count === stage) {
        elapsed = 3_000
      }
    }
    await expect(readDarwinManagedProcessIdentities([123])).rejects.toThrow('could not be verified')
    expect(inspect).toHaveBeenCalledTimes(stage)
  })

  it('skips empty requests and rejects invalid PIDs before querying', async () => {
    expect(await readDarwinManagedProcessIdentities([])).toEqual(new Map())
    for (const pid of [0, -1, 1.5, Number.NaN]) {
      await expect(readDarwinManagedProcessIdentities([pid])).rejects.toThrow('could not be verified')
    }
    expect(inspect).not.toHaveBeenCalled()
  })
})
