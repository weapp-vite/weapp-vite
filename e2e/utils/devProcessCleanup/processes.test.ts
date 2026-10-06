import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
