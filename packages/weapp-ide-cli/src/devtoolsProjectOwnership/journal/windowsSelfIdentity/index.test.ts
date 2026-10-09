import { Buffer } from 'node:buffer'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { beforeEach, expect, it, vi } from 'vitest'
import { windowsSelfIdentityCommand } from './command'
import { readWindowsJournalWriterIdentity } from './index'
import { SELF_IDENTITY_WIRE } from './wire'

const { inspect, debug } = vi.hoisted(() => ({ inspect: vi.fn(), debug: Object.assign(vi.fn(), { enabled: false }) }))
vi.mock('execa', () => ({ execa: inspect }))
vi.mock('node:util', async original => ({ ...await original<typeof import('node:util')>(), debuglog: () => debug }))
const ticks = '639269962527968118'
const started = '2026-10-07T18:57:32.7968110Z'
const stdout = [SELF_IDENTITY_WIRE, 'present', String(process.pid), ticks, ticks, 'false', started, Buffer.from(process.execPath).toString('base64')].join('\t')

beforeEach(() => {
  inspect.mockReset()
  debug.mockReset()
  debug.enabled = false
})

it('queries only the current process through the unchanged ten second budget', async () => {
  inspect.mockResolvedValueOnce({ exitCode: 0, stdout, stderr: '', timedOut: false })
  await expect(readWindowsJournalWriterIdentity()).resolves.toEqual({ pid: process.pid, executable: process.execPath, started })
  const [command, args, options] = inspect.mock.calls[0]!
  expect(command).toBe('powershell.exe')
  expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command'])
  expect(args[3]).toContain(`[System.Diagnostics.Process]::GetProcessById(${process.pid})`)
  expect(args[3]).not.toMatch(/Get-CimInstance|ConvertTo-Json|Stop-Process|taskkill/)
  expect(options).toMatchObject({ timeout: 10_000, reject: false, windowsHide: true })
  expect(inspect).toHaveBeenCalledOnce()
})

it.each([
  { exitCode: 1, stderr: `${SELF_IDENTITY_WIRE}:error:System.ComponentModel.Win32Exception:-2147467259\r\n` },
  { exitCode: 1, stderr: `${SELF_IDENTITY_WIRE}:error:System.ArgumentException:-2147024809\r\n` },
  { exitCode: 1, stderr: `${SELF_IDENTITY_WIRE}:error:System.InvalidOperationException:-2146233079\r\n` },
  { exitCode: 0, stdout: '' },
  { exitCode: 0, stderr: 'unexpected warning' },
  { exitCode: 0, failed: true },
  { exitCode: undefined, signal: 'SIGTERM', timedOut: true },
])('fails closed without a retry for missing, denied, exited or uncertain observations: %j', async (result) => {
  inspect.mockResolvedValueOnce({ stdout, stderr: '', ...result })
  await expect(readWindowsJournalWriterIdentity()).rejects.toThrow('could not be verified')
  expect(inspect).toHaveBeenCalledOnce()
})

it('does not retry or substitute an approximate identity after launch failure', async () => {
  const failure = Object.assign(new Error('PowerShell unavailable'), { code: 'ENOENT' })
  inspect.mockRejectedValueOnce(failure)
  await expect(readWindowsJournalWriterIdentity()).rejects.toBe(failure)
  expect(inspect).toHaveBeenCalledOnce()
})

it('never interpolates a non-integer PID into a command', () => {
  for (const pid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => windowsSelfIdentityCommand(pid)).toThrow('positive writer PID')
  }
})

function tracedQuery(result: Record<string, unknown>) {
  debug.enabled = true
  const stream = new PassThrough()
  const pending = (options: { stripFinalNewline?: boolean }) => Object.assign(Promise.resolve({
    exitCode: 0,
    stdout,
    // 模拟 Execa 默认会裁掉末尾换行；不保留该边界时完整阶段行会被误判为残缺。
    stderr: options.stripFinalNewline === false
      ? `${SELF_IDENTITY_WIRE}:phase:complete\r\n`
      : `${SELF_IDENTITY_WIRE}:phase:complete`,
    ...result,
  }), {
    stderr: stream,
    nodeChildProcess: {
      once: vi.fn((event: string, listener: () => void) => {
        if (event === 'spawn') {
          listener()
        }
      }),
    },
  })
  inspect.mockImplementationOnce((_command, _args, options) => pending(options))
  const query = readWindowsJournalWriterIdentity()
  stream.end(`${SELF_IDENTITY_WIRE}:phase:entry\nprivate field read details\n${SELF_IDENTITY_WIRE}:phase:module-path\n`)
  return query
}

it('keeps exact identity and the original budget while tracing query phases', async () => {
  await expect(tracedQuery({})).resolves.toEqual({ pid: process.pid, executable: process.execPath, started })
  expect(inspect).toHaveBeenCalledOnce()
  expect(inspect.mock.calls[0]![2]).toMatchObject({ timeout: 10_000, reject: false, stripFinalNewline: false })
  expect(debug.mock.calls.map(call => call[1]).slice(0, 4)).toEqual(['launch', 'spawn', 'entry', 'module-path'])
  expect(JSON.stringify(debug.mock.calls)).not.toContain('private field read details')
})

it.each([
  { exitCode: undefined, signal: 'SIGTERM', timedOut: true },
  { stderr: `${SELF_IDENTITY_WIRE}:phase:entry\nprivate field read details\n` },
  { stderr: `${SELF_IDENTITY_WIRE}:phase:unknown\n` },
  { stdout: '' },
])('retains failures while tracing instead of accepting phase evidence: %j', async (result) => {
  await expect(tracedQuery(result)).rejects.toThrow('could not be verified')
  expect(inspect).toHaveBeenCalledOnce()
  expect(JSON.stringify(debug.mock.calls)).not.toContain('private field read details')
})
