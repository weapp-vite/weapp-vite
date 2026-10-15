import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { expect, it, vi } from 'vitest'
import { runWithCleanup } from '../runWithCleanup'
import { queryWindowsKernelProcesses } from './windowsKernelQuery'

const execute = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execute }))

it('preserves the query timeout and directory-removal failure together', async () => {
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
  let queryDirectory: string | undefined
  const exitHandlers = vi.spyOn(process, 'once')
  await runWithCleanup(async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('SystemRoot', directory)
    vi.stubEnv('TMPDIR', directory)
    vi.stubEnv('TMP', directory)
    vi.stubEnv('TEMP', directory)
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '0')
    execute.mockImplementation(async (command: string, args: string[]) => {
      if (basename(command) === 'csc.exe') {
        const output = args.find(argument => argument.startsWith('/out:'))!.slice('/out:'.length)
        await fs.writeFile(output, 'compiler fixture')
        return { exitCode: 0, stdout: '', stderr: '' }
      }
      queryDirectory = dirname(command)
      return queryFailure
    })
    vi.spyOn(fs, 'rm').mockImplementation(async (target, options) => {
      if (String(target) === queryDirectory) {
        throw cleanupFailure
      }
      return remove(target, options)
    })
    const failure: unknown = await queryWindowsKernelProcesses([61]).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(AggregateError)
    const aggregate = failure as AggregateError
    expect(aggregate.errors).toHaveLength(2)
    expect(aggregate.errors[0]).toBe(queryFailure)
    expect(aggregate.errors[1]).toBe(cleanupFailure)
    expect(aggregate.cause).toBe(queryFailure)
  }, async () => {
    for (const [event, handler] of exitHandlers.mock.calls) {
      if (event === 'exit') {
        process.removeListener('exit', handler)
      }
    }
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await remove(directory, { recursive: true, force: true })
  })
})
