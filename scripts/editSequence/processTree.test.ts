import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { exec } from 'tinyexec'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { observeProcessTree, parseProcessMemory, summarizeProcessTree } from './processTree'

vi.mock('node:process', () => ({ default: { platform: 'win32' } }))
vi.mock('tinyexec', () => ({ exec: vi.fn() }))
beforeAll(async () => {
  // 真实 Windows 的模块预热含异步读取；先等待公共采样入口就绪，再隔离各测试的调用记录。
  // 否则预热可能在前几个同步测试之后才调用 exec，被误认成带根 PID 的实际查询。
  vi.mocked(exec).mockResolvedValue({
    stdout: JSON.stringify([{ ProcessId: 10, ParentProcessId: 1, WorkingSetSize: '2048' }]),
  } as Awaited<ReturnType<typeof exec>>)
  await observeProcessTree(10)
  vi.resetAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

function mockObservedQuery(run: (child: EventEmitter, stdout: PassThrough, stderr: PassThrough) => void, cause?: Error) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const child = Object.assign(new EventEmitter(), { stdout, stderr })
  vi.mocked(exec).mockImplementationOnce(() => {
    const query = new Promise((resolve, reject) => {
      queueMicrotask(() => {
        try {
          run(child, stdout, stderr)
        }
        catch (error) {
          reject(error)
          return
        }
        if (cause) {
          reject(cause)
        }
        else {
          resolve({ stdout: JSON.stringify([{ ProcessId: 10, ParentProcessId: 1, WorkingSetSize: 2048 }]) })
        }
      })
    })
    return Object.assign(query, { process: child }) as unknown as ReturnType<typeof exec>
  })
  return { child, stdout, stderr }
}

function expectDiagnosticsReleased({ child, stdout, stderr }: ReturnType<typeof mockObservedQuery>) {
  expect(child.eventNames()).toEqual([])
  for (const stream of [stdout, stderr]) {
    for (const event of ['data', 'end', 'close']) {
      expect(stream.listenerCount(event)).toBe(0)
    }
  }
}

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

it('preserves Windows working sets above the 32-bit boundary through JSON and tree aggregation', () => {
  const rows = parseProcessMemory(JSON.stringify([
    { ProcessId: 10, ParentProcessId: 1, WorkingSetSize: 5_368_709_121 },
    { ProcessId: 11, ParentProcessId: 10, WorkingSetSize: '4294967297' },
    { ProcessId: 90, ParentProcessId: 1, WorkingSetSize: 8_589_934_593 },
  ]), 'win32')
  expect(rows[0]?.rssBytes).toBe(5_368_709_121)
  expect(rows[1]?.rssBytes).toBe(4_294_967_297)
  expect(summarizeProcessTree(rows, 10)).toMatchObject({ processCount: 2, rssBytes: 9_663_676_418 })
})

it('queries the registered Windows process tree without starting the CIM provider', async () => {
  vi.mocked(exec).mockResolvedValue({ stdout: JSON.stringify([
    { ProcessId: 10, ParentProcessId: 1, WorkingSetSize: '2048' },
    { ProcessId: 12, ParentProcessId: 10, WorkingSetSize: '1024' },
    { ProcessId: 99, ParentProcessId: 1, WorkingSetSize: '999999' },
  ]) } as Awaited<ReturnType<typeof exec>>)
  expect(await observeProcessTree(10)).toMatchObject({ processCount: 2, rssBytes: 3072 })
  expect(exec).toHaveBeenCalledOnce()
  const [command, args, options] = vi.mocked(exec).mock.calls[0]!
  expect(command).toBe('powershell.exe')
  expect(args).toEqual(expect.arrayContaining(['-NoProfile', '-NonInteractive']))
  expect(args).toContain('-EncodedCommand')
  const script = Buffer.from(args!.at(-1)!, 'base64').toString('utf16le')
  expect(script).toContain('CreateToolhelp32Snapshot')
  expect(script).toContain('WorkingSet64')
  expect(script).toContain('weapp-vite-edit-sequence-process-tree-v3.dll')
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

it.each([false, true])('preserves safe script phases when a Windows query times out (entered=%s)', async (entered) => {
  const stderr = new PassThrough()
  const cause = new Error('query deadline exceeded')
  vi.mocked(exec).mockImplementationOnce(() => {
    const query = new Promise((_, reject) => {
      queueMicrotask(() => {
        if (entered) {
          stderr.write('process-tree:script-')
          stderr.write('enter\r\nprocess-tree:helper-cache-hit\r\n')
          stderr.write('unrelated diagnostic\r\nprocess-tree:helper-ready\r\n')
        }
        reject(cause)
      })
    })
    return Object.assign(query, { process: { stderr } }) as unknown as ReturnType<typeof exec>
  })
  await expect(observeProcessTree(10)).rejects.toMatchObject({
    message: expect.stringContaining(`phases=${JSON.stringify(entered ? ['script-enter', 'helper-cache-hit', 'helper-ready'] : [])}`),
    cause,
  })
  expect(exec).toHaveBeenCalledOnce()
  expect(vi.mocked(exec).mock.calls[0]?.[2]).toMatchObject({ timeout: 10_000 })
  expect(stderr.listenerCount('data')).toBe(0)
})

it('separates serialization, output write, stdout EOF and child exit without consuming stdout', async () => {
  let now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const cause = new Error('query deadline exceeded')
  const fixture = mockObservedQuery((child, stdout, stderr) => {
    expect(stdout.listenerCount('data')).toBe(0)
    expect(stdout.readableFlowing).toBeNull()
    now = 1003
    child.emit('spawn')
    now = 1007
    stderr.write('process-tree:script-enter elapsedMs=0\r')
    now = 1008
    stderr.write('\nprocess-tree:helper-cache-hit elapsedMs=1\r\nprocess-tree:helper-')
    now = 1013
    stderr.write('ready elapsedMs=4\r\nprocess-tree:query-complete elapsedMs=5\r\n')
    now = 1019
    stderr.write('process-tree:json-serialized elapsedMs=9\r\nprocess-tree:json-output-written elapsedMs=10\r\n')
    now = 1021
    stdout.emit('end')
    now = 1023
    child.emit('exit', 0, null)
    now = 1024
    stdout.emit('close')
    now = 1025
    child.emit('close', 0, null)
    expect(stdout.readableFlowing).toBeNull()
  }, cause)
  const error = await observeProcessTree(10).catch((error: unknown) => error)
  expect(error).toMatchObject({ cause })
  expect(error).toBeInstanceOf(Error)
  const timings: unknown = JSON.parse((error as Error).message.split('; timings=')[1]!)
  expect(timings).toEqual({
    execStartedMs: 0,
    execReturnedMs: 0,
    spawnMs: 3,
    phases: [
      { phase: 'script-enter', elapsedMs: 0, receivedMs: 8 },
      { phase: 'helper-cache-hit', elapsedMs: 1, receivedMs: 8 },
      { phase: 'helper-ready', elapsedMs: 4, receivedMs: 13 },
      { phase: 'query-complete', elapsedMs: 5, receivedMs: 13 },
      { phase: 'json-serialized', elapsedMs: 9, receivedMs: 19 },
      { phase: 'json-output-written', elapsedMs: 10, receivedMs: 19 },
    ],
    stdoutEndMs: 21,
    stdoutCloseMs: 24,
    exit: { receivedMs: 23, code: 0, signal: null },
    close: { receivedMs: 25, code: 0, signal: null },
  })
  expect(exec).toHaveBeenCalledOnce()
  expect(vi.mocked(exec).mock.calls[0]?.[2]).toMatchObject({ timeout: 10_000, throwOnError: true })
  expectDiagnosticsReleased(fixture)
})

it('filters unsafe diagnostics and bounds records without turning noise into a phase', async () => {
  const cause = new Error('query deadline exceeded')
  const secret = 'unrelated-private-content'
  const fixture = mockObservedQuery((child, _stdout, stderr) => {
    stderr.write(`${secret}\nprocess-tree:script-enter elapsedMs=-1\nprocess-tree:helper-ready elapsedMs=Infinity\n`)
    stderr.write('process-tree:helper-ready elapsedMs=9007199254740992\n')
    stderr.write(`process-tree:query-complete elapsedMs=3 ${secret}\nprocess-tree:${secret} elapsedMs=4\n`)
    stderr.write('x'.repeat(400))
    stderr.write('\r\nprocess-tree:query-complete elapsedMs=1.5\r\n')
    stderr.write('process-tree:json-output-written elapsedMs=2\n'.repeat(40))
    child.emit('error', new Error(secret))
    child.emit('exit', Number.NaN, secret)
    child.emit('close', -1, secret)
  }, cause)
  const error = await observeProcessTree(10).catch((error: unknown) => error)
  expect(error).toMatchObject({ cause })
  const message = (error as Error).message
  expect(message).not.toContain(secret)
  expect(message).not.toContain('Infinity')
  expect(message).not.toContain('9007199254740992')
  const timings = JSON.parse(message.split('; timings=')[1]!) as { phases: unknown[], exit: unknown, close: unknown }
  expect(timings.phases).toHaveLength(16)
  expect(timings.phases[0]).toMatchObject({ phase: 'query-complete', elapsedMs: 1.5 })
  expect(timings.exit).toEqual({ receivedMs: expect.any(Number) })
  expect(timings.close).toEqual({ receivedMs: expect.any(Number) })
  expectDiagnosticsReleased(fixture)
})

it('releases passive diagnostics after a successful observation and retains other listeners', async () => {
  const other = vi.fn()
  const fixture = mockObservedQuery((child, stdout, stderr) => {
    child.on('spawn', other)
    stdout.on('end', other)
    stderr.on('data', other)
    child.emit('spawn')
    stderr.write('process-tree:script-enter elapsedMs=0\n')
    stdout.emit('end')
    child.emit('exit', 0, null)
    child.emit('close', 0, null)
  })
  expect(await observeProcessTree(10)).toMatchObject({ processCount: 1, rssBytes: 2048 })
  expect(fixture.child.listeners('spawn')).toEqual([other])
  expect(fixture.stdout.listeners('end')).toEqual([other])
  expect(fixture.stderr.listeners('data')).toEqual([other])
  fixture.child.off('spawn', other)
  fixture.stdout.off('end', other)
  fixture.stderr.off('data', other)
  expectDiagnosticsReleased(fixture)
})

it('keeps the original timeout cause when diagnostic listener removal fails', async () => {
  const cause = new Error('query deadline exceeded')
  const fixture = mockObservedQuery((child) => {
    const off = child.off.bind(child)
    vi.spyOn(child, 'off').mockImplementation((event, listener) => {
      off(event, listener)
      throw new Error('diagnostic removal failed')
    })
    child.emit('exit', null, 'SIGTERM')
    child.emit('close', null, 'SIGTERM')
  }, cause)
  const error = await observeProcessTree(10).catch((error: unknown) => error)
  expect(error).toMatchObject({ cause })
  expect((error as Error).message).not.toContain('diagnostic removal failed')
  const timings: unknown = JSON.parse((error as Error).message.split('; timings=')[1]!)
  expect(timings).toMatchObject({
    exit: { code: null, signal: 'SIGTERM' },
    close: { code: null, signal: 'SIGTERM' },
  })
  expectDiagnosticsReleased(fixture)
})
