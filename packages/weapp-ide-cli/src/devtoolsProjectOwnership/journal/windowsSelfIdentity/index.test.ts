import { Buffer } from 'node:buffer'
import process from 'node:process'
import { beforeEach, expect, it, vi } from 'vitest'
import { windowsSelfIdentityCommand } from './command'
import { readWindowsJournalWriterIdentity } from './index'
import { SELF_IDENTITY_WIRE } from './wire'

const inspect = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: inspect }))
const ticks = '639269962527968118'
const started = '2026-10-07T18:57:32.7968110Z'
const stdout = [SELF_IDENTITY_WIRE, 'present', String(process.pid), ticks, ticks, 'false', started, Buffer.from(process.execPath).toString('base64')].join('\t')

beforeEach(() => inspect.mockReset())

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
