import { afterEach, describe, expect, it, vi } from 'vitest'
import { readLinuxProcessState, waitForProcessExit } from './processState'

afterEach(() => vi.useRealTimers())

const pid = process.pid
const ownerToken = 'release-fixture-owner'

function procError(code: string) {
  return Object.assign(new Error(`proc fixture: ${code}`), { code })
}

function createProcessReader(states: Array<string | Error>, environment: string | Error) {
  let stateIndex = 0
  return vi.fn(async (file: string) => {
    let value: string | Error
    if (file === `/proc/${pid}/stat`) {
      const state = states[Math.min(stateIndex++, states.length - 1)]!
      value = state instanceof Error ? state : `${pid} (release ) fixture) ${state} 1 2 3`
    }
    else if (file === `/proc/${pid}/environ`) {
      value = environment
    }
    else {
      throw new Error(`Unexpected proc fixture file: ${file}`)
    }
    if (value instanceof Error) {
      throw value
    }
    return value
  })
}

describe('Linux release fixture process observation', () => {
  it.each(['Z', 'X'])('recognizes an exited %s process whose environment is no longer readable', async (state) => {
    const readFile = createProcessReader([state], procError('EACCES'))
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('zombie')
  })

  it.each(['EACCES', 'EPERM'])('rechecks process state when its environment becomes %s during exit', async (code) => {
    const readFile = createProcessReader(['R', 'Z'], procError(code))
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('zombie')
  })

  it.each(['ENOENT', 'ESRCH'])('recognizes %s process removal after an environment permission race', async (code) => {
    const readFile = createProcessReader(['R', procError(code)], procError('EACCES'))
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('gone')
  })

  it('recognizes a process that exits while its environment becomes empty', async () => {
    const readFile = createProcessReader(['R', 'Z'], '')
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('zombie')
  })

  it.each(['EACCES', 'EPERM'])('preserves %s for an unreadable environment of a running process', async (code) => {
    const error = procError(code)
    const readFile = createProcessReader(['R', 'S'], error)
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).rejects.toBe(error)
  })

  it('requires an exact owner token before reporting a process as running', async () => {
    const readFile = createProcessReader(['S'], `FIXTURE_OWNER_TOKEN=${ownerToken}-other\0`)
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('foreign')
  })

  it('reports a live process with its matching owner token as running', async () => {
    const readFile = createProcessReader(['S'], `OTHER=value\0FIXTURE_OWNER_TOKEN=${ownerToken}\0`)
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('running')
  })

  it.each(['ENOENT', 'ESRCH'])('recognizes a process removed with %s before observation', async (code) => {
    const readFile = createProcessReader([procError(code)], procError(code))
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('gone')
  })

  it.each(['ENOENT', 'ESRCH'])('recognizes a process removed with %s between state and environment reads', async (code) => {
    const readFile = createProcessReader(['R'], procError(code))
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).resolves.toBe('gone')
  })

  it('preserves a state permission error instead of treating the process as gone', async () => {
    const error = procError('EACCES')
    const readFile = createProcessReader([error], `FIXTURE_OWNER_TOKEN=${ownerToken}\0`)
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).rejects.toBe(error)
  })

  it('preserves unrelated environment errors instead of assuming an exit', async () => {
    const error = procError('EIO')
    const readFile = createProcessReader(['R', 'Z'], error)
    await expect(readLinuxProcessState(pid, ownerToken, readFile)).rejects.toBe(error)
  })
})

describe('release process terminal observation', () => {
  it.each(['EACCES', 'EPERM'])('keeps observing %s during exit until stat proves a terminal state', async (code) => {
    vi.useFakeTimers()
    let statReads = 0
    const readFile = async (file: string) => {
      if (file.endsWith('/stat')) {
        statReads += 1
        return `17 (fixture) ${statReads < 3 ? 'R' : 'Z'} 1 17`
      }
      throw Object.assign(new Error('environment temporarily unreadable'), { code })
    }
    const assertion = expect(waitForProcessExit(() => readLinuxProcessState(17, 'owned', readFile))).resolves.toBe('zombie')
    await vi.runAllTimersAsync()
    await assertion
    expect(statReads).toBe(3)
  })

  it.each(['EACCES', 'EPERM'])('fails on persistent %s within the original budget, including after a running sample', async (code) => {
    vi.useFakeTimers()
    const error = Object.assign(new Error('live process unreadable'), { code })
    const readState = vi.fn<() => ReturnType<typeof readLinuxProcessState>>()
      .mockResolvedValueOnce('running')
      .mockRejectedValue(error)
    const startedAt = Date.now()
    const assertion = expect(waitForProcessExit(readState, 50)).rejects.toBe(error)
    await vi.runAllTimersAsync()
    await assertion
    expect(Date.now() - startedAt).toBe(50)
    expect(readState).toHaveBeenCalledTimes(3)
  })

  it.each(['gone', 'zombie', 'foreign', 'running'] as const)('uses fresh %s after a permission transition', async (state) => {
    vi.useFakeTimers()
    const readState = vi.fn<() => ReturnType<typeof readLinuxProcessState>>()
      .mockRejectedValueOnce(Object.assign(new Error('exit transition'), { code: 'EACCES' }))
      .mockResolvedValue(state)
    const assertion = expect(waitForProcessExit(readState, 50)).resolves.toBe(state)
    await vi.runAllTimersAsync()
    await assertion
    expect(readState).toHaveBeenCalledTimes(state === 'running' ? 3 : 2)
  })

  it('does not retry unrelated observation failures', async () => {
    const error = Object.assign(new Error('unexpected read failure'), { code: 'EIO' })
    const readState = vi.fn<() => ReturnType<typeof readLinuxProcessState>>().mockRejectedValue(error)
    await expect(waitForProcessExit(readState)).rejects.toBe(error)
    expect(readState).toHaveBeenCalledTimes(1)
  })
})
