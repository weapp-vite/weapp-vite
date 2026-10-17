import { spawn } from 'node:child_process'
import { once } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { runWithCleanup } from '../runWithCleanup'
import { fixtureWindowsProcessRows } from '../testSupport/windowsProcessRows'
import { readDevProcessIdentities } from './processes'

const query = vi.hoisted(() => vi.fn())
vi.mock('./windowsKernelQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./windowsKernelQuery')>()
  return { ...actual, queryWindowsKernelProcesses: query }
})

const retained = { ProcessId: 61, ParentProcessId: 1, ExecutablePath: null, Started: '2026-10-08T00:00:00.0000200Z' }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
})
afterEach(() => vi.restoreAllMocks())

it('accepts a retained incomplete row as exited only after an independent ESRCH result', async () => {
  const live = { ProcessId: 71, ParentProcessId: 1, ExecutablePath: 'foreign-node.exe', Started: '2026-10-08T00:00:00.0000300Z' }
  query.mockResolvedValue({ exitCode: 0, stdout: fixtureWindowsProcessRows([retained, live]), stderr: '' })
  vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
    expect(signal).toBe(0)
    if (pid === 61) {
      throw Object.assign(new Error('Process exited'), { code: 'ESRCH' })
    }
    return true
  })
  expect(await readDevProcessIdentities([61, 71])).toEqual(new Map([
    [61, undefined],
    [71, { pid: 71, executable: live.ExecutablePath, started: live.Started }],
  ]))
})

it('refuses an incomplete identity while the PID is still alive', async () => {
  query.mockResolvedValue({ exitCode: 0, stdout: fixtureWindowsProcessRows([retained]), stderr: '' })
  vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
    expect(signal).toBe(0)
    return true
  })
  await expect(readDevProcessIdentities([61])).rejects.toBeInstanceOf(Error)
})

it('preserves a denied liveness probe instead of treating the process as exited', async () => {
  query.mockResolvedValue({ exitCode: 0, stdout: fixtureWindowsProcessRows([retained]), stderr: '' })
  const denied = Object.assign(new Error('Process probe denied'), { code: 'EPERM' })
  vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
    expect(signal).toBe(0)
    throw denied
  })
  await expect(readDevProcessIdentities([61])).rejects.toBe(denied)
})

it('does not convert a failed kernel query into exit evidence', async () => {
  const failed = new Error('Kernel query failed')
  query.mockRejectedValue(failed)
  const probe = vi.spyOn(process, 'kill').mockImplementation(() => {
    throw Object.assign(new Error('Process exited'), { code: 'ESRCH' })
  })
  await expect(readDevProcessIdentities([61])).rejects.toBe(failed)
  expect(probe).not.toHaveBeenCalled()
})

it('observes a real child exit while the same incomplete snapshot row remains', async () => {
  const child = spawn(process.execPath, ['-e', 'process.stdin.resume()'], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true })
  const closed = Promise.allSettled([once(child, 'close', { signal: AbortSignal.timeout(5_000) })])
  await runWithCleanup(async () => {
    await once(child, 'spawn', { signal: AbortSignal.timeout(5_000) })
    const pid = child.pid!
    query.mockResolvedValue({ exitCode: 0, stdout: fixtureWindowsProcessRows([{ ...retained, ProcessId: pid }]), stderr: '' })
    await expect(readDevProcessIdentities([pid])).rejects.toBeInstanceOf(Error)
    child.stdin.end()
    const [result] = await closed
    if (result.status === 'rejected') {
      throw result.reason
    }
    expect(result.value).toEqual([0, null])
    expect(await readDevProcessIdentities([pid])).toEqual(new Map([[pid, undefined]]))
  }, async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill()
    }
    const [result] = await closed
    if (result.status === 'rejected') {
      throw result.reason
    }
  })
})
