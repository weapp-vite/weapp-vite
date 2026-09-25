import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it, vi } from 'vitest'
import { descendantPids, runCollector, terminateTree } from './process'

vi.mock('execa', async (original) => {
  const actual = await original<typeof import('execa')>()
  return { ...actual, execa: vi.fn(actual.execa) }
})
afterEach(() => vi.clearAllMocks())

it('only collects descendants of the owned process', () => {
  expect(descendantPids(10, '10 1\n11 10\n12 11\n20 1')).toEqual([12, 11, 10])
})

it('bounds a silent child, preserves failed output and rejects launch failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-process-'))
  try {
    const options = { cwd: root, logFile: path.join(root, 'run.log'), timeoutMs: 500 }
    await expect(runCollector(process.execPath, ['-e', 'console.log("started"); setInterval(() => {}, 1000)'], options)).rejects.toThrow('deadline')
    expect(await readFile(options.logFile, 'utf8')).toContain('deadline')
    await expect(runCollector('missing-performance-command', [], options)).rejects.toThrow('failed')
    await expect(runCollector(process.execPath, ['-e', 'console.error("failure evidence");process.exit(3)'], options)).rejects.toThrow('exit=3')
    expect(await readFile(options.logFile, 'utf8')).toContain('failure evidence')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 10_000)

it('uses Windows process-tree termination without a shell', async () => {
  // eslint-disable-next-line e18e/ban-dependencies -- 验证跨平台进程树清理调用。
  const { execa } = await import('execa')
  vi.mocked(execa).mockResolvedValueOnce({ exitCode: 0 } as never)
  await terminateTree(123, 'win32')
  expect(execa).toHaveBeenCalledWith('taskkill', ['/PID', '123', '/T', '/F'], expect.objectContaining({ timeout: 10_000 }))
})
