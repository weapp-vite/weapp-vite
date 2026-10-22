import { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))

beforeEach(() => {
  vi.resetModules()
  execute.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it.each(['running', 'exited-awaiting-close', 'closed', 'rejected'] as const)('preserves the compiler %s failure, original cause and cleanup within the existing deadline', async (phase) => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'kernel-compiler-evidence-'))
  try {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    for (const key of new Set(['SystemRoot', ...Object.keys(process.env).filter(key => key.toLowerCase() === 'systemroot')])) {
      vi.stubEnv(key, directory)
    }
    for (const key of ['TMPDIR', 'TMP', 'TEMP']) {
      vi.stubEnv(key, directory)
    }
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '0')
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const child = new ChildProcess()
    Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough() })
    const original = Object.assign(new Error('original compiler failure'), {
      exitCode: undefined,
      signal: 'SIGTERM',
      timedOut: true,
      stdout: '',
      stderr: '',
    })
    execute.mockImplementation(() => Object.assign(new Promise((resolve, reject) => {
      queueMicrotask(() => {
        child.emit('spawn')
        if (phase === 'exited-awaiting-close' || phase === 'closed') {
          child.emit('exit', null, 'SIGTERM')
        }
        if (phase === 'closed') {
          child.emit('close', null, 'SIGTERM')
        }
        if (phase === 'rejected') {
          reject(original)
        }
        else {
          resolve(original)
        }
      })
    }), { nodeChildProcess: child }))
    const { queryWindowsKernelProcesses } = await import('./windowsKernelQuery')
    const failure: unknown = await queryWindowsKernelProcesses([61]).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).cause).toBe(original)
    expect((failure as Error).message).toContain(`"phase":"${phase === 'rejected' ? 'running' : phase}"`)
    expect((failure as Error).message).not.toContain('original compiler failure')
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]![2]).toMatchObject({ timeout: expect.any(Number), stdin: 'ignore', reject: false, windowsHide: true })
    expect(execute.mock.calls[0]![2].timeout).toBeGreaterThan(10_000)
    expect(execute.mock.calls[0]![2].timeout).toBeLessThanOrEqual(30_000)
    expect(await fs.readdir(directory)).toEqual([])
    expect(child.eventNames()).toEqual([])
    expect(child.stdout!.listenerCount('data')).toBe(0)
    expect(child.stderr!.listenerCount('data')).toBe(0)
    expect(output).not.toHaveBeenCalled()
  }
  finally {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await fs.rm(directory, { recursive: true, force: true })
  }
})
