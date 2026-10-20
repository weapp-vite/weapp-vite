import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDevProcessTrace } from './devProcessTrace'

const reportPaths = vi.hoisted(() => ({ current: undefined as { reportDir: string } | undefined }))
vi.mock('./ideWarningReport', () => ({ resolveIdeWarningReportPathsFromEnv: () => reportPaths.current }))

interface TraceEvent {
  kind: string
  sequence: number
  observedAt: string
  stream?: string
  data?: string
  status?: string
  reason?: string
  exitCode?: number
  late?: boolean
}

describe('optional dev output trace', () => {
  let directory: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-process-trace-'))
    reportPaths.current = { reportDir: directory }
    vi.stubEnv('WEAPP_VITE_E2E_DEV_PROCESS_TRACE', '1')
    vi.stubEnv('WEAPP_VITE_E2E_DEV_PROCESS_TRACE_DIR', '')
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  function readEvents(tracePath: string): TraceEvent[] {
    return fs.readFileSync(tracePath, 'utf8').trim().split('\n').map(line => JSON.parse(line) as TraceEvent)
  }

  it('does not create artifacts unless enabled', () => {
    vi.stubEnv('WEAPP_VITE_E2E_DEV_PROCESS_TRACE', undefined)
    expect(createDevProcessTrace('fixture')).toBeUndefined()
    expect(fs.readdirSync(directory)).toEqual([])
  })

  it('retains long, partial, binary and CRLF chunks in observed order without sanitizing them', () => {
    const trace = createDevProcessTrace('fixture')!
    const chunks = ['before\r\n', 'x'.repeat(20_000), '半行', Buffer.from([0, 255, 10])]
    trace.write('all', chunks[0]!)
    trace.write('all', chunks[1]!)
    trace.write('all', chunks[2]!)
    trace.write('all', chunks[3]!)
    trace.close({ exitCode: 0, reason: 'process-exited' })
    trace.close({ exitCode: 1, reason: 'process-exited' })

    const events = readEvents(trace.path)
    expect(events.map(event => event.kind)).toEqual(['start', 'chunk', 'chunk', 'chunk', 'chunk', 'end'])
    expect(events.map(event => event.sequence)).toEqual([0, 1, 2, 3, 4, 5])
    expect(events.every(event => !Number.isNaN(Date.parse(event.observedAt)))).toBe(true)
    expect(events.slice(1, -1).map(event => Buffer.from(event.data!, 'base64'))).toEqual(
      chunks.map(chunk => typeof chunk === 'string' ? Buffer.from(chunk) : chunk),
    )
    expect(events.at(-1)).toMatchObject({ exitCode: 0, status: 'complete' })
    expect(trace.getFailure()).toBeUndefined()
    expect(path.dirname(trace.path)).toBe(path.join(directory, 'dev-process'))
  })

  it('uses a configured directory and unique files without requiring a report', () => {
    reportPaths.current = undefined
    vi.stubEnv('WEAPP_VITE_E2E_DEV_PROCESS_TRACE_DIR', directory)
    const first = createDevProcessTrace('first')!
    const second = createDevProcessTrace('second')!
    first.close({ reason: 'process-exited' })
    second.close({ reason: 'process-exited' })
    expect(first.path).not.toBe(second.path)
    expect(path.dirname(first.path)).toBe(directory)
    expect(fs.readdirSync(directory)).toHaveLength(2)
  })

  it('writes only the allowed exit fields even when the caller object has command metadata', () => {
    const trace = createDevProcessTrace('fixture')!
    const exit = {
      exitCode: 1,
      signal: 'SIGTERM',
      reason: 'process-exited' as const,
      shortMessage: 'fixture-cli --token fixture-secret',
      argv: ['--token', 'fixture-secret'],
    }
    trace.close(exit)
    expect(readEvents(trace.path).at(-1)).toMatchObject({ exitCode: 1, reason: 'process-exited' })
    expect(fs.readFileSync(trace.path, 'utf8')).not.toContain('fixture-secret')
  })

  it('rejects a missing destination before starting capture', () => {
    reportPaths.current = undefined
    expect(() => createDevProcessTrace('fixture')).toThrow('requires an active IDE report')
  })

  it('retains a write failure and records an incomplete end when the destination recovers', () => {
    const trace = createDevProcessTrace('fixture')!
    const failure = new Error('fixture disk failure')
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
      throw failure
    })
    expect(() => trace.write('stderr', 'lost output')).not.toThrow()
    write.mockRestore()
    trace.close({ exitCode: 1, reason: 'process-exited' })
    expect(trace.getFailure()?.cause).toBe(failure)
    expect(readEvents(trace.path).at(-1)).toMatchObject({ status: 'incomplete', reason: 'process-exited' })
  })

  it('persists late raw chunks and appends the final incomplete status after a completed end', () => {
    const trace = createDevProcessTrace('fixture')!
    trace.close({ exitCode: 0, reason: 'process-exited' })
    const late = Buffer.from([255, 0, 10])
    trace.write('stdout', late)
    trace.close({ exitCode: 0, reason: 'process-exited' })
    expect(trace.getFailure()?.cause).toEqual(new Error('Output arrived after the trace ended.'))
    const events = readEvents(trace.path)
    expect(events.map(event => event.kind)).toEqual(['start', 'end', 'chunk', 'end'])
    expect(events.map(event => event.sequence)).toEqual([0, 1, 2, 3])
    expect(events[1]).toMatchObject({ status: 'complete' })
    expect(events[2]).toMatchObject({ late: true, stream: 'stdout' })
    expect(Buffer.from(events[2]!.data!, 'base64')).toEqual(late)
    expect(events.at(-1)).toMatchObject({ exitCode: 0, status: 'incomplete', reason: 'late-output' })
  })

  it('retains late-output and append failures as separate causes', () => {
    const trace = createDevProcessTrace('fixture')!
    trace.close({ reason: 'process-exited' })
    const appendFailure = new Error('fixture append failed')
    vi.spyOn(fs, 'appendFileSync').mockImplementationOnce(() => {
      throw appendFailure
    })
    trace.write('stdout', 'late output')
    const causes = trace.getFailure()?.cause as AggregateError
    expect(causes).toBeInstanceOf(AggregateError)
    expect(causes.errors).toEqual([new Error('Output arrived after the trace ended.'), appendFailure])
  })
})
