import { Buffer } from 'node:buffer'
import { exec } from 'tinyexec'
import { afterEach, expect, it, vi } from 'vitest'
import { observeProcessTree, parseProcessMemory, summarizeProcessTree } from './processTree'

vi.mock('node:process', () => ({ default: { platform: 'win32' } }))
vi.mock('tinyexec', () => ({ exec: vi.fn() }))
afterEach(() => vi.resetAllMocks())

it('counts the entire owned process tree without including unrelated workers', () => {
  const rows = parseProcessMemory('10 1 20\n12 11 30\n11 10 40\n90 1 9000\n', 'darwin')
  expect(summarizeProcessTree(rows, 10)).toMatchObject({ rssBytes: 90 * 1024, processCount: 3 })
  expect(() => summarizeProcessTree(rows, 100)).toThrow('exited')
})

it('keeps Windows RSS in bytes and handles one row and CRLF output', () => {
  const rows = parseProcessMemory('{"ProcessId":10,"ParentProcessId":1,"WorkingSetSize":"2048"}\r\n', 'win32')
  expect(summarizeProcessTree(rows, 10).rssBytes).toBe(2048)
  expect(() => summarizeProcessTree([{ pid: 10, parentPid: 1, rssBytes: Number.NaN }], 10)).toThrow('Invalid')
})

it('queries the registered Windows process tree without starting the CIM provider', async () => {
  vi.mocked(exec).mockResolvedValue({ stdout: JSON.stringify([
    { ProcessId: 10, ParentProcessId: 1, WorkingSetSize: '2048' },
    { ProcessId: 12, ParentProcessId: 10, WorkingSetSize: '1024' },
    { ProcessId: 99, ParentProcessId: 1, WorkingSetSize: '999999' },
  ]) } as Awaited<ReturnType<typeof exec>>)
  expect(await observeProcessTree(10)).toMatchObject({ processCount: 2, rssBytes: 3072 })
  const [command, args, options] = vi.mocked(exec).mock.calls[0]!
  expect(command).toBe('powershell.exe')
  expect(args).toEqual(expect.arrayContaining(['-NoProfile', '-NonInteractive']))
  expect(args).toContain('-EncodedCommand')
  const script = Buffer.from(args!.at(-1)!, 'base64').toString('utf16le')
  expect(script).toContain('CreateToolhelp32Snapshot')
  expect(script).toContain('WorkingSet64')
  expect(script).toContain('-RootProcessId 10')
  expect(script).not.toContain('Get-CimInstance')
  expect(options).toMatchObject({ timeout: 10_000, throwOnError: true })
})

it.each([Number.NaN, 0, -1, 1.5, 0x100000000])('rejects an invalid root PID before starting a command: %s', async (pid) => {
  await expect(observeProcessTree(pid)).rejects.toThrow('Invalid process-tree root PID')
  expect(exec).not.toHaveBeenCalled()
})

it('identifies the observation phase and preserves query failures without retrying', async () => {
  const cause = new Error('query deadline exceeded')
  vi.mocked(exec).mockRejectedValue(cause)
  await expect(observeProcessTree(10)).rejects.toMatchObject({
    message: expect.stringContaining('Process-tree memory observation failed on win32'),
    cause,
  })
  expect(exec).toHaveBeenCalledOnce()
})
