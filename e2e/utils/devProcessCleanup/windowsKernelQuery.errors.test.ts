import { ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { runWithCleanup } from '../runWithCleanup'
import { queryWindowsKernelProcesses } from './windowsKernelQuery'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))
vi.mock('./windowsKernelArtifact', () => ({ readWindowsKernelInspector: () => new Uint8Array([1, 2, 3]) }))

it.each(['returned', 'rejected'] as const)('preserves a %s query failure and directory-removal failure after native close', async (outcome) => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'kernel-query-errors-'))
  const remove = fs.rm
  const queryFailure = Object.assign(new Error('query failed'), {
    exitCode: undefined,
    signal: 'SIGTERM',
    timedOut: true,
    stdout: '',
    stderr: 'partial query evidence',
  })
  const cleanupFailure = Object.assign(new Error('directory removal denied'), { code: 'EPERM' })
  const child = new ChildProcess()
  const queryResult = Promise.withResolvers<typeof queryFailure>()
  const dispatched = Promise.withResolvers<void>()
  let queryDirectory: string | undefined
  let query: Promise<unknown> | undefined
  let cleanupAttempted = false
  await runWithCleanup(async () => {
    execute.mockReset()
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('TMPDIR', directory)
    vi.stubEnv('TMP', directory)
    vi.stubEnv('TEMP', directory)
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '0')
    execute.mockImplementation((command: string) => {
      queryDirectory = dirname(command)
      dispatched.resolve()
      return Object.assign(queryResult.promise, { nodeChildProcess: child })
    })
    vi.spyOn(fs, 'rm').mockImplementation(async (target, options) => {
      if (String(target) === queryDirectory) {
        cleanupAttempted = true
        throw cleanupFailure
      }
      return remove(target, options)
    })
    let settled = false
    query = queryWindowsKernelProcesses([61]).catch((error: unknown) => error).then((value) => {
      settled = true
      return value
    })
    await dispatched.promise
    child.emit('exit', null, 'SIGTERM')
    if (outcome === 'returned') {
      queryResult.resolve(queryFailure)
    }
    else {
      queryResult.reject(queryFailure)
    }
    // Execa 回执和 exit 均已到达；只有同一原生 child 的 close 才允许回收目录。
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(cleanupAttempted).toBe(false)
    expect(await fs.readdir(queryDirectory!)).toEqual(['snapshot.exe'])
    child.emit('close', null, 'SIGTERM')
    const failure = await query
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]![0]).toBe(join(queryDirectory!, 'snapshot.exe'))
    expect(execute.mock.calls[0]![1]).toEqual(['--pids', '61'])
    expect(execute.mock.calls[0]![2]).toMatchObject({ timeout: expect.any(Number), stdin: 'ignore', reject: false, windowsHide: true })
    expect(execute.mock.calls[0]![2].timeout).toBeGreaterThan(10_000)
    expect(execute.mock.calls[0]![2].timeout).toBeLessThanOrEqual(30_000)
    expect(cleanupAttempted).toBe(true)
    expect(failure).toBeInstanceOf(AggregateError)
    const aggregate = failure as AggregateError
    expect(aggregate.errors).toHaveLength(2)
    expect(aggregate.errors[0]).toBe(queryFailure)
    expect(aggregate.errors[1]).toBe(cleanupFailure)
    expect(aggregate.cause).toBe(queryFailure)
    expect(child.eventNames()).toEqual([])
  }, async () => {
    queryResult.resolve(queryFailure)
    child.emit('close', null, 'SIGTERM')
    await query
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await remove(directory, { recursive: true, force: true })
  })
})
