import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { exec } from 'tinyexec'
import { beforeEach, expect, it, vi } from 'vitest'

const { runtime } = vi.hoisted(() => ({ runtime: { platform: 'win32' } }))
vi.mock('node:process', () => ({ default: runtime }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('tinyexec', () => ({ exec: vi.fn() }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  runtime.platform = 'win32'
  vi.mocked(readFile).mockResolvedValue('param([uint32]$RootProcessId, [switch]$Warm)')
  vi.mocked(exec).mockResolvedValue({
    stdout: JSON.stringify([{ ProcessId: 10, ParentProcessId: 1, WorkingSetSize: 2048 }]),
  } as Awaited<ReturnType<typeof exec>>)
})

it('does not read or start the Windows helper when importing or closing an observer without resource sampling', async () => {
  const { createProcessObserver } = await import('./processObserver')
  const observer = createProcessObserver('weapp-modes', 'fixture')
  await observer.close()
  expect(readFile).not.toHaveBeenCalled()
  expect(exec).not.toHaveBeenCalled()
})

it('shares one pending warmup before concurrent Windows queries and preserves both command budgets', async () => {
  const warmup = Promise.withResolvers<Awaited<ReturnType<typeof exec>>>()
  vi.mocked(exec).mockReturnValueOnce(warmup.promise as unknown as ReturnType<typeof exec>)
  const { observeProcessTree } = await import('./processTree')
  const first = observeProcessTree(10)
  const second = observeProcessTree(10)
  await vi.waitFor(() => expect(exec).toHaveBeenCalledOnce())
  const [command, args, options] = vi.mocked(exec).mock.calls[0]!
  expect(command).toBe('powershell.exe')
  expect(Buffer.from(args!.at(-1)!, 'base64').toString('utf16le')).toMatch(/-Warm$/)
  expect(options).toEqual({ timeout: 30_000, throwOnError: true })
  warmup.resolve({ stdout: '' } as Awaited<ReturnType<typeof exec>>)
  expect(await Promise.all([first, second])).toEqual([
    expect.objectContaining({ processCount: 1, rssBytes: 2048 }),
    expect.objectContaining({ processCount: 1, rssBytes: 2048 }),
  ])
  expect(exec).toHaveBeenCalledTimes(3)
  for (const [, queryArgs, queryOptions] of vi.mocked(exec).mock.calls.slice(1)) {
    expect(Buffer.from(queryArgs!.at(-1)!, 'base64').toString('utf16le')).toMatch(/-RootProcessId 10$/)
    expect(queryOptions).toEqual({ timeout: 10_000, throwOnError: true })
  }
})

it('propagates the same warmup failure to waiting observations without retrying or starting queries', async () => {
  const cause = new Error('Windows helper warmup timed out')
  vi.mocked(exec).mockRejectedValue(cause)
  const { observeProcessTree } = await import('./processTree')
  const results = await Promise.allSettled([observeProcessTree(10), observeProcessTree(10)])
  expect(results).toEqual([
    { status: 'rejected', reason: cause },
    { status: 'rejected', reason: cause },
  ])
  await expect(observeProcessTree(10)).rejects.toBe(cause)
  expect(exec).toHaveBeenCalledOnce()
  expect(vi.mocked(exec).mock.calls[0]?.[2]).toEqual({ timeout: 30_000, throwOnError: true })
})

it('rejects invalid ownership before preparing the helper', async () => {
  const { observeProcessTree } = await import('./processTree')
  await expect(observeProcessTree(0)).rejects.toThrow('Invalid process-tree root PID')
  expect(readFile).not.toHaveBeenCalled()
  expect(exec).not.toHaveBeenCalled()
})

it('keeps non-Windows sampling free of Windows helper preparation', async () => {
  runtime.platform = 'darwin'
  vi.mocked(exec).mockResolvedValue({ stdout: '10 1 2\n' } as Awaited<ReturnType<typeof exec>>)
  const { observeProcessTree } = await import('./processTree')
  expect(await observeProcessTree(10)).toMatchObject({ processCount: 1, rssBytes: 2048 })
  expect(readFile).not.toHaveBeenCalled()
  expect(exec).toHaveBeenCalledExactlyOnceWith('ps', ['-axo', 'pid=,ppid=,rss='], { timeout: 10_000, throwOnError: true })
})
