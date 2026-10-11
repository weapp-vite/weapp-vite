import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { cleanupFixtureProcesses, readLinuxFixtureProcess, withFixtureProcessCleanup } from './processFixture'

const pid = process.pid
const owner = 'fixture-owner'
const stat = (state: string) => `${pid} (fixture (worker)) ${state} 0 0\n`
const ioError = (code: string) => Object.assign(new Error(code), { code })

describe('Linux fixture process observation', () => {
  it.each(['Z', 'X'])('does not read a terminal %s process environment', async (state) => {
    const read = vi.fn().mockResolvedValue(stat(state))
    await expect(readLinuxFixtureProcess(pid, owner, read)).resolves.toBe('zombie')
    expect(read.mock.calls).toEqual([[`/proc/${pid}/stat`]])
  })

  it.each([
    ['EACCES', 'Z'],
    ['EACCES', 'X'],
    ['EACCES', 'gone'],
    ['EPERM', 'Z'],
    ['EPERM', 'X'],
    ['EPERM', 'gone'],
  ])('confirms the terminal state after %s races with %s', async (code, state) => {
    const read = vi.fn().mockResolvedValueOnce(stat('S')).mockRejectedValueOnce(ioError(code))
    if (state === 'gone') {
      read.mockRejectedValueOnce(ioError('ENOENT'))
    }
    else {
      read.mockResolvedValueOnce(stat(state))
    }
    await expect(readLinuxFixtureProcess(pid, owner, read)).resolves.toBe(state === 'gone' ? 'gone' : 'zombie')
    expect(read.mock.calls).toEqual([[`/proc/${pid}/stat`], [`/proc/${pid}/environ`], [`/proc/${pid}/stat`]])
  })

  it.each(['EACCES', 'EPERM'])('keeps %s on a live registered process as a failure without killing it', async (code) => {
    const denied = ioError(code)
    const read = vi.fn().mockResolvedValueOnce(stat('S')).mockRejectedValueOnce(denied).mockResolvedValueOnce(stat('S'))
    const kill = vi.fn()
    const wait = vi.fn()
    await expect(cleanupFixtureProcesses([{ pid, role: 'command' }], owner, {
      inspect: () => readLinuxFixtureProcess(pid, owner, read),
      kill,
      wait,
    })).rejects.toBe(denied)
    expect(kill).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('retains both errors if denied environment access cannot be followed by a confirmed state', async () => {
    const denied = ioError('EACCES')
    const unavailable = ioError('EIO')
    const read = vi.fn().mockResolvedValueOnce(stat('S')).mockRejectedValueOnce(denied).mockRejectedValueOnce(unavailable)
    const kill = vi.fn()
    await expect(cleanupFixtureProcesses([{ pid, role: 'command' }], owner, {
      inspect: () => readLinuxFixtureProcess(pid, owner, read),
      kill,
    })).rejects.toMatchObject({ errors: [denied, unavailable], cause: denied })
    expect(kill).not.toHaveBeenCalled()
  })

  it.each(['', 'FIXTURE_OWNER_TOKEN=someone-else\0', `PREFIX_FIXTURE_OWNER_TOKEN=${owner}\0`])('rejects unowned environments and checks for an exit race: %j', async (environment) => {
    const alive = vi.fn().mockResolvedValueOnce(stat('S')).mockResolvedValueOnce(environment).mockResolvedValueOnce(stat('S'))
    await expect(readLinuxFixtureProcess(pid, owner, alive)).resolves.toBe('foreign')
    const exited = vi.fn().mockResolvedValueOnce(stat('S')).mockResolvedValueOnce(environment).mockResolvedValueOnce(stat('Z'))
    await expect(readLinuxFixtureProcess(pid, owner, exited)).resolves.toBe('zombie')
  })

  it('requires a complete owner token for a live process', async () => {
    const read = vi.fn().mockResolvedValueOnce(stat('S')).mockResolvedValueOnce(`OTHER=value\0FIXTURE_OWNER_TOKEN=${owner}\0`)
    await expect(readLinuxFixtureProcess(pid, owner, read)).resolves.toBe('running')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('propagates other I/O failures without assuming process exit', async () => {
    const failure = ioError('EIO')
    const read = vi.fn().mockResolvedValueOnce(stat('S')).mockRejectedValueOnce(failure)
    await expect(readLinuxFixtureProcess(pid, owner, read)).rejects.toBe(failure)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed state before inspecting ownership', async () => {
    const read = vi.fn().mockResolvedValue('incomplete')
    await expect(readLinuxFixtureProcess(pid, owner, read)).rejects.toThrow('process state')
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe('registered fixture cleanup', () => {
  it('continues cleaning confirmed owned records after another registered record is inaccessible', async () => {
    const denied = ioError('EACCES')
    const inspect = vi.fn().mockRejectedValueOnce(denied).mockResolvedValueOnce('running')
    const kill = vi.fn()
    const wait = vi.fn().mockResolvedValue('gone')
    await expect(cleanupFixtureProcesses([{ pid, role: 'supervisor' }, { pid: pid + 1, role: 'descendant' }], owner, { inspect, kill, wait })).rejects.toBe(denied)
    expect(inspect.mock.calls).toEqual([[pid, owner], [pid + 1, owner]])
    expect(kill.mock.calls).toEqual([[pid + 1]])
    expect(wait.mock.calls).toEqual([[pid + 1, owner]])
  })

  it.each(['foreign', 'gone', 'zombie'])('does not kill a %s record', async (state) => {
    const kill = vi.fn()
    const wait = vi.fn()
    await cleanupFixtureProcesses([{ pid, role: 'command' }], owner, { inspect: vi.fn().mockResolvedValue(state), kill, wait })
    expect(kill).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it.each(['running', 'foreign'])('reports an unconfirmed %s state after attempting cleanup', async (state) => {
    const kill = vi.fn()
    await expect(cleanupFixtureProcesses([{ pid, role: 'command' }], owner, {
      inspect: vi.fn().mockResolvedValue('running'),
      kill,
      wait: vi.fn().mockResolvedValue(state),
    })).rejects.toThrow(`did not confirm process exit: ${state}`)
    expect(kill).toHaveBeenCalledExactlyOnceWith(pid)
  })

  it('checks exit even if the process disappeared before signaling', async () => {
    const wait = vi.fn().mockResolvedValue('gone')
    await cleanupFixtureProcesses([{ pid, role: 'command' }], owner, {
      inspect: vi.fn().mockResolvedValue('running'),
      kill: () => { throw ioError('ESRCH') },
      wait,
    })
    expect(wait).toHaveBeenCalledExactlyOnceWith(pid, owner)
  })

  it('retains failures from every registered record', async () => {
    const first = ioError('EACCES')
    const second = ioError('EPERM')
    await expect(cleanupFixtureProcesses([{ pid, role: 'supervisor' }, { pid: pid + 1, role: 'descendant' }], owner, {
      inspect: vi.fn().mockRejectedValueOnce(first).mockResolvedValueOnce('running'),
      kill: () => { throw second },
    })).rejects.toMatchObject({ errors: [first, second] })
  })
})

describe('fixture test and cleanup failures', () => {
  it('preserves the original failure after successful cleanup', async () => {
    const original = new Error('body assertion')
    const cleanup = vi.fn().mockResolvedValue(undefined)
    await expect(withFixtureProcessCleanup(async () => {
      throw original
    }, cleanup)).rejects.toBe(original)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('preserves a cleanup failure after a successful body', async () => {
    const cleanup = new Error('cleanup')
    await expect(withFixtureProcessCleanup(async () => {}, async () => {
      throw cleanup
    })).rejects.toBe(cleanup)
  })

  it('reports both the initial assertion and cleanup error', async () => {
    const original = new Error('body assertion')
    const cleanup = new Error('cleanup')
    await expect(withFixtureProcessCleanup(async () => {
      throw original
    }, async () => {
      throw cleanup
    })).rejects.toMatchObject({ errors: [original, cleanup], cause: original })
  })
})
