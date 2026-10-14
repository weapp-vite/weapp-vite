/* eslint-disable e18e/ban-dependencies -- 只 mock execa，纯契约测试不启动采样进程。 */
import process from 'node:process'
import { setImmediate } from 'node:timers/promises'
import { execa } from 'execa'
import { beforeEach, expect, it, vi } from 'vitest'
import { createWindowsSampler, parseWindowsSections, readWindowsSnapshot, WINDOWS_SAMPLE_LIMIT, WINDOWS_SAMPLE_TIMEOUT, WindowsSnapshotError, windowsSnapshotScript } from './windows'

vi.mock('execa', () => ({ execa: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('retains CRLF/BOM partial primitives and malformed output as separate evidence', () => {
  expect(parseWindowsSections('\uFEFF{"phase":"script-begin"}\r\n{"phase":"processes","result":[]}\r\npartial')).toEqual([
    { phase: 'script-begin' },
    { phase: 'processes', result: [] },
    expect.objectContaining({ phase: 'parse-error', output: 'partial' }),
  ])
})

it('uses a bounded task-owned native command and preserves partial stdout on timeout', async () => {
  vi.mocked(execa).mockResolvedValue({ failed: true, exitCode: undefined, signal: 'SIGKILL', timedOut: true, stderr: 'native query incomplete', stdout: '{"phase":"script-begin"}\r\n{"phase":"processes","result":[]}' } as unknown as Awaited<ReturnType<typeof execa>>)
  const result = readWindowsSnapshot([process.pid])
  await expect(result).rejects.toBeInstanceOf(WindowsSnapshotError)
  await expect(result).rejects.toMatchObject({ partial: [{ phase: 'script-begin' }, { phase: 'processes', result: [] }] })
  expect(execa).toHaveBeenCalledWith('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', windowsSnapshotScript([process.pid])], expect.objectContaining({ timeout: WINDOWS_SAMPLE_TIMEOUT, shell: false, killDescendants: true, killSignal: 'SIGKILL', forceKillAfterDelay: false }))
})

it('only selects explicit protocol/host PIDs while global TCP output stays aggregated', () => {
  const script = windowsSnapshotScript([process.pid, process.pid, -1, Number.NaN])
  expect(script).toContain(`$taskProcessIds = @(${process.pid})`)
  expect(script).toContain('Get-Process -Id $taskProcessId')
  expect(script).toContain('$taskProcessIds -contains $_.OwningProcess')
  expect(script).toContain('Group-Object State')
  expect(script).not.toMatch(/Stop-Process|taskkill|CommandLine|ExecutablePath|ProcessName|Restart|Set-Net/i)
})

it('does not sample another platform or overlap/retry a pending Windows query', async () => {
  const record = vi.fn()
  const read = vi.fn(() => new Promise<unknown[]>(() => {}))
  const other = createWindowsSampler(record, read, 'darwin')
  other.sample('first-navigation', [process.pid])
  await other.stop()
  expect(read).not.toHaveBeenCalled()
  let resolve!: (value: unknown[]) => void
  read.mockImplementation(() => new Promise((done) => {
    resolve = done
  }))
  const sampler = createWindowsSampler(record, read, 'win32')
  sampler.sample('first-navigation', [process.pid])
  sampler.sample('navigation-failed', [process.pid])
  await setImmediate()
  expect(read).toHaveBeenCalledOnce()
  expect(record).toHaveBeenCalledWith(expect.objectContaining({ event: 'windows-sample-skipped', reason: 'sample-in-progress' }))
  const stop = sampler.stop()
  resolve([{ phase: 'script-begin' }])
  await stop
  sampler.sample('after-stop', [process.pid])
  expect(read).toHaveBeenCalledOnce()
})

it('limits samples and archives the original query error plus partial evidence', async () => {
  const record = vi.fn()
  const original = new WindowsSnapshotError('native timeout', [{ phase: 'script-begin' }])
  const read = vi.fn(async () => {
    throw original
  })
  const sampler = createWindowsSampler(record, read, 'win32')
  for (let index = 0; index < WINDOWS_SAMPLE_LIMIT + 1; index++) {
    sampler.sample(`phase-${index}`, [process.pid])
    await setImmediate()
  }
  await sampler.stop()
  expect(read).toHaveBeenCalledTimes(WINDOWS_SAMPLE_LIMIT)
  expect(record).toHaveBeenCalledWith(expect.objectContaining({ event: 'windows-sample-skipped', reason: 'sample-limit' }))
  expect(record).toHaveBeenCalledWith(expect.objectContaining({ event: 'diagnostic-error', error: { name: 'WindowsSnapshotError', message: 'native timeout' }, partial: [{ phase: 'script-begin' }] }))
})
