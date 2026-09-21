import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupProcessesByCommandPatterns } from './dev-process'

const execaMock = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('node:process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:process')>()
  return { default: { ...actual.default, pid: 41, ppid: 31, platform: 'linux', kill: vi.fn() } }
})

describe('residual process cleanup ownership', () => {
  beforeEach(() => {
    execaMock.mockReset()
    vi.mocked(process.kill).mockReset()
  })

  function mockProcesses(rows: string[]) {
    const alive = new Set(rows.map(row => Number(row.split(' ')[0])))
    execaMock.mockResolvedValue({ stdout: rows.join('\r\n') })
    vi.mocked(process.kill).mockImplementation((pid, signal) => {
      if (!alive.has(pid)) {
        throw new Error('Process has exited')
      }
      if (signal !== 0) {
        alive.delete(pid)
      }
      return true
    })
  }

  function terminatedPids() {
    return vi.mocked(process.kill).mock.calls.filter(([, signal]) => signal !== 0).map(([pid]) => pid)
  }

  it('protects the caller and all ancestors while cleaning matching siblings and children', async () => {
    mockProcesses([
      '1 0 init',
      '11 1 shell --ide-marker',
      '21 11 launcher --ide-marker',
      '31 21 runner --ide-marker',
      '41 31 worker --ide-marker',
      '51 21 stale --ide-marker',
      '52 51 stale-child',
      '61 41 owned --ide-marker',
      '71 21 unrelated',
    ])
    await cleanupProcessesByCommandPatterns(['--ide-marker'], 0)
    expect(terminatedPids()).toEqual([52, 51, 61])
  })

  it('protects the parent chain even when the process snapshot omits the caller', async () => {
    mockProcesses(['1 0 init', '21 1 shell --ide-marker', '31 21 runner --ide-marker'])
    await cleanupProcessesByCommandPatterns([/--ide-marker/g], 0)
    expect(terminatedPids()).toEqual([])
  })

  it('terminates ancestor traversal if the snapshot contains a cycle', async () => {
    mockProcesses(['21 31 shell --ide-marker', '31 21 runner --ide-marker', '41 31 worker --ide-marker'])
    await cleanupProcessesByCommandPatterns(['--ide-marker'], 0)
    expect(terminatedPids()).toEqual([])
  })
})
