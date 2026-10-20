import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startDevProcess } from './dev-process'

const execaMock = vi.hoisted(() => vi.fn())
const cleanupRun = vi.hoisted(() => vi.fn())
vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))
vi.mock('./devProcessCleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./devProcessCleanup')>()
  return {
    createDevProcessCleanup: (...args: Parameters<typeof actual.createDevProcessCleanup>) => {
      const cleanup = actual.createDevProcessCleanup(...args)
      return async (...cleanupArgs: Parameters<typeof cleanup>) => {
        cleanupRun()
        return cleanup(...cleanupArgs)
      }
    },
  }
})

interface TraceEvent {
  kind: string
  stream?: string
  data?: string
  exitCode?: number
  reason?: string
  status?: string
  late?: boolean
}

describe('dev process output trace lifecycle', () => {
  let directory: string

  beforeEach(() => {
    cleanupRun.mockClear()
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-process-trace-lifecycle-'))
    vi.stubEnv('WEAPP_VITE_E2E_DEV_PROCESS_TRACE', '1')
    vi.stubEnv('WEAPP_VITE_E2E_DEV_PROCESS_TRACE_DIR', directory)
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  function readEvents(): TraceEvent[] {
    const files = fs.readdirSync(directory)
    expect(files).toHaveLength(1)
    return fs.readFileSync(path.join(directory, files[0]!), 'utf8').trim().split('\n').map(line => JSON.parse(line) as TraceEvent)
  }

  function createChild(all: boolean) {
    let finish!: (result: { exitCode: number }) => void
    const child = Object.assign(new Promise<{ exitCode: number }>((resolve) => {
      finish = resolve
    }), {
      all: all ? new EventEmitter() : undefined,
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      nodeChildProcess: { exitCode: 0 },
    })
    execaMock.mockReturnValueOnce(child)
    return { child, finish }
  }

  it('observes all once and flushes natural exit before repeated stop without recording argv or env', async () => {
    const { child, finish } = createChild(true)
    const dev = startDevProcess('fixture-cli', ['--token', 'fixture-secret'], {
      all: true,
      env: { FIXTURE_TOKEN: 'fixture-secret' },
    })
    child.all!.emit('data', 'first chunk')
    child.all!.emit('data', 'last chunk')
    expect(child.stdout.listenerCount('data')).toBe(0)
    expect(child.stderr.listenerCount('data')).toBe(0)
    finish({ exitCode: 0 })
    await Promise.all([dev.stop(0), dev.stop(0)])
    expect(dev.getOutput()).toBe('first chunklast chunk')
    const events = readEvents()
    expect(events.map(event => event.kind)).toEqual(['start', 'chunk', 'chunk', 'end'])
    expect(events.slice(1, -1).map(event => Buffer.from(event.data!, 'base64').toString())).toEqual(['first chunk', 'last chunk'])
    expect(events.at(-1)).toMatchObject({ exitCode: 0 })
    expect(JSON.stringify(events)).not.toContain('fixture-secret')
  })

  it('retains separate stream names without changing the in-memory output', async () => {
    const { child, finish } = createChild(false)
    const dev = startDevProcess('fixture-cli', [])
    child.stdout.emit('data', 'stdout')
    child.stderr.emit('data', Buffer.from('stderr'))
    finish({ exitCode: 1 })
    await dev.stop(0)
    expect(dev.getOutput()).toBe('stdoutstderr')
    expect(readEvents().filter(event => event.kind === 'chunk').map(event => event.stream)).toEqual(['stdout', 'stderr'])
  })

  it('terminates the trace on synchronous spawn failure while preserving the original error', () => {
    const failure = new Error('fixture spawn failed')
    execaMock.mockImplementationOnce(() => {
      throw failure
    })
    expect(() => startDevProcess('fixture-cli', [])).toThrow(failure)
    expect(readEvents().map(event => event.kind)).toEqual(['start', 'end'])
    expect(readEvents().at(-1)).toMatchObject({ reason: 'spawn-failed' })
  })

  it.each(['ENOENT', 'EXIT'])('omits secret argv from asynchronous %s failure traces and keeps the controller cause', async (code) => {
    let reject!: (error: Error) => void
    const failure = Object.assign(new Error('fixture process failed with fixture-secret'), {
      code,
      shortMessage: 'Command failed: fixture-cli --token fixture-secret',
      exitCode: code === 'EXIT' ? 1 : undefined,
    })
    const child = Object.assign(new Promise<never>((_resolve, rejectChild) => {
      reject = rejectChild
    }), { all: new EventEmitter(), nodeChildProcess: { exitCode: 0 } })
    execaMock.mockReturnValueOnce(child)
    const dev = startDevProcess('fixture-cli', ['--token', 'fixture-secret'], { all: true })
    const waiting = dev.waitFor(new Promise<never>(() => {}), 'fixture readiness').catch(error => error as unknown)
    reject(failure)
    const error = await waiting
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).cause).toBe(failure)
    await dev.stop(0)
    const events = readEvents()
    expect(events.map(event => event.kind)).toEqual(['start', 'end'])
    expect(events.at(-1)).toMatchObject({ reason: 'process-exited' })
    expect(JSON.stringify(events)).not.toContain('fixture-secret')
    expect(JSON.stringify(events)).not.toContain('shortMessage')
  })

  it('persists late chunks and replaces a successful stop result without repeating cleanup', async () => {
    const { child, finish } = createChild(true)
    const dev = startDevProcess('fixture-cli', [], { all: true })
    finish({ exitCode: 0 })
    const firstStop = dev.stop(0)
    await firstStop
    const late = Buffer.from([255, 0, 10])
    child.all!.emit('data', late)
    const nextStop = dev.stop(0)
    expect(nextStop).not.toBe(firstStop)
    expect(dev.stop(0)).toBe(nextStop)
    await expect(nextStop).rejects.toThrow('output trace is incomplete')
    expect(cleanupRun).toHaveBeenCalledTimes(1)
    const events = readEvents()
    expect(events.map(event => event.kind)).toEqual(['start', 'end', 'chunk', 'end'])
    expect(events[2]).toMatchObject({ late: true })
    expect(Buffer.from(events[2]!.data!, 'base64')).toEqual(late)
    expect(events.at(-1)).toMatchObject({ status: 'incomplete', reason: 'late-output' })
  })

  it('keeps the original wait error together with sink failure and rejects idempotent stop', async () => {
    const { child, finish } = createChild(true)
    const dev = startDevProcess('fixture-cli', [], { all: true })
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw new Error('fixture sink failed')
    })
    child.all!.emit('data', 'unavailable chunk')
    write.mockRestore()
    const original = new Error('original runtime assertion')
    const error = await dev.waitFor(Promise.reject(original), 'fixture assertion').catch(error => error as unknown)
    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors[0].message).toContain(original.message)
    expect((error as AggregateError).errors[1].cause.message).toBe('fixture sink failed')
    finish({ exitCode: 1 })
    const stopping = dev.stop(0)
    expect(dev.stop(0)).toBe(stopping)
    await expect(stopping).rejects.toThrow('output trace is incomplete')
  })

  it('keeps the original cleanup failure together with an independent trace failure', async () => {
    const { child, finish } = createChild(true)
    const dev = startDevProcess('fixture-cli', [], { all: true })
    finish({ exitCode: 0 })
    await expect(dev.waitFor(new Promise<never>(() => {}), 'fixture exit')).rejects.toThrow('Dev process exited')
    child.all!.emit('data', 'late output')
    const original = new Error('fixture cleanup failure')
    cleanupRun.mockImplementationOnce(() => {
      throw original
    })
    const error = await dev.stop(0).catch(error => error as unknown)
    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors[0]).toBe(original)
    expect((error as AggregateError).errors[1].cause.message).toBe('Output arrived after the trace ended.')
    await expect(dev.stop(0)).rejects.toThrow('output trace is incomplete')
  })
})
