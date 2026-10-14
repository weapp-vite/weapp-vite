import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- Windows 原生查询兼容验收使用正式跨平台进程封装。
import { execa } from 'execa'
import { expect, it } from 'vitest'
import { sameManagedProcess } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/processIdentity'
import { resolveWechatInspectionTimeout } from '../../../packages/weapp-ide-cli/src/devtoolsTarget/inspection'
import { windowsKernelProcessQuery, windowsLegacyProcessStarted } from './windowsKernelQuery'
import { parseWindowsProcessRows } from './windowsProcessRows'
import { createWindowsKernelProcessQueryCommand, createWindowsProcessQueryCommand, parseWindowsQueryTrace } from './windowsQueryTrace'

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 0x100000000])('rejects an invalid PID before dispatch: %s', (pid) => {
  expect(() => windowsKernelProcessQuery([pid])).toThrow(TypeError)
})

it('preserves the old microsecond identity without rounding away the raw native value', () => {
  const raw = '2026-10-13T04:05:06.1234569Z'
  expect(windowsLegacyProcessStarted(raw)).toBe('2026-10-13T04:05:06.1234560Z')
  expect(raw).toBe('2026-10-13T04:05:06.1234569Z')
  expect(windowsLegacyProcessStarted('2026-10-13T04:05:06.1234560Z')).toBe('2026-10-13T04:05:06.1234560Z')
})

it.each(['', '2026-02-30T04:05:06.1234560Z', '2026-10-13T04:05:06.123Z', '2026-10-13T04:05:06.1234560+00:00'])('refuses an incomplete or invalid creation time: %j', (started) => {
  expect(windowsLegacyProcessStarted(started)).toBeUndefined()
})

interface WindowsRow {
  ProcessId: number
  ParentProcessId: number
  ExecutablePath: string | null
  Started: string | null
}

function row(values: unknown[], pid: number): WindowsRow {
  const found = values.filter(value => value && typeof value === 'object' && 'ProcessId' in value && value.ProcessId === pid)
  expect(found).toHaveLength(1)
  const value = found[0] as WindowsRow
  expect(value.ParentProcessId).toBeGreaterThan(0)
  expect(value.ExecutablePath).toBeTruthy()
  expect(value.Started).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/)
  return value
}

// 本地 Unix 无法证明 Windows Interop；Windows CI 用同一仍持有的 worker 核验旧身份精度。
it.runIf(process.platform === 'win32')('matches the held worker CIM identity with full and filtered native snapshots', async () => {
  const timeout = resolveWechatInspectionTimeout('win32')
  const query = async (command: string) => {
    const result = await execa('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout, windowsHide: true })
    return { result, rows: parseWindowsProcessRows(result.stdout) }
  }
  const full = await query(createWindowsKernelProcessQueryCommand(undefined, true))
  const filtered = await query(createWindowsKernelProcessQueryCommand([process.pid], false))
  const legacy = await query(createWindowsProcessQueryCommand(` -Filter 'ProcessId=${process.pid}'`, false))
  const first = row(full.rows, process.pid)
  const second = row(filtered.rows, process.pid)
  const prior = row(legacy.rows, process.pid)
  expect(first).toEqual(second)
  expect(filtered.rows).toHaveLength(1)
  expect(first.ParentProcessId).toBe(prior.ParentProcessId)
  expect(sameManagedProcess(
    { pid: first.ProcessId, executable: first.ExecutablePath!, started: windowsLegacyProcessStarted(first.Started!)! },
    { pid: prior.ProcessId, executable: prior.ExecutablePath!, started: prior.Started! },
  )).toBe(true)
  expect(parseWindowsQueryTrace(full.result.stderr).map(marker => `${marker.stage}:${marker.event}`)).toEqual([
    'script:begin',
    'utf8:begin',
    'utf8:end',
    'query:begin',
    'query:end',
    'serialize:begin',
    'serialize:end',
    'script:end',
  ])
}, 60_000)
