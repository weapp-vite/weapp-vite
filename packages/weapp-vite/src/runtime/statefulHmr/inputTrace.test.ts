import { createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { CompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { createStatefulHmrInputTrace } from './inputTrace'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('does not inspect or hash input captures without exact opt-in', () => {
  const host = new CompilerHmrHost()
  const inspect = vi.spyOn(host, 'inspectInput')
  const emit = vi.fn()
  for (const enabled of ['', '0', 'true']) {
    vi.stubEnv('WEAPP_VITE_STATEFUL_HMR_INPUT_TRACE', enabled)
    const trace = createStatefulHmrInputTrace({ root: () => '/repo', emit })
    expect(trace).toBeUndefined()
    host.capture('/repo/src/page.vue', 'private source')
  }
  expect(inspect).not.toHaveBeenCalled()
  expect(emit).not.toHaveBeenCalled()
})

it('records normalized identities, scalar ownership and source revisions without source or private paths', () => {
  const lines: string[] = []
  const host = new CompilerHmrHost()
  const trace = createStatefulHmrInputTrace({ root: () => 'C:/private/repo', enabled: '1', emit: line => lines.push(line) })!
  const release = trace.observe(host)
  const file = 'C:\\private\\repo\\src\\page.vue'
  host.captureRaw(file, 'PRIVATE-SOURCE-A', false)
  trace.input('watch-after', file, host, { event: 'update' })
  host.captureRaw(file, 'PRIVATE-SOURCE-B', false)
  trace.input('sidecar-before', 'D:/personal/secret.vue', host)
  release()
  release()
  const events = lines.map(line => JSON.parse(line.slice('[stateful-hmr-input] '.length)) as Record<string, unknown>)
  expect(events).toContainEqual(expect.objectContaining({
    stage: 'watch-after',
    file: 'src/page.vue',
    canonicalFile: 'src/page.vue',
    input: expect.objectContaining({ revision: 1, raw: true, explicitRaw: true, source: { state: 'present', bytes: 16, sha256: digest('PRIVATE-SOURCE-A') } }),
  }))
  expect(events).toContainEqual(expect.objectContaining({ stage: 'capture', operation: 'raw', after: expect.objectContaining({ revision: 2 }) }))
  expect(events).toContainEqual(expect.objectContaining({ stage: 'sidecar-before', file: '<external>' }))
  expect(events.map(event => event.sequence)).toEqual(events.map((_event, index) => index + 1))
  expect(new Set(events.map(event => event.sessionId)).size).toBe(1)
  expect(lines.join('\n')).not.toMatch(/PRIVATE-SOURCE|private|personal|secret|C:|D:/)
  const previous = lines.length
  host.capture(file, 'PRIVATE-SOURCE-C')
  expect(lines).toHaveLength(previous)
})

it('keeps capture results and original errors when inspection or emit fails', () => {
  const host = new CompilerHmrHost()
  const file = '/repo/src/page.vue'
  const trace = createStatefulHmrInputTrace({
    root: () => '/repo',
    enabled: '1',
    emit: () => {
      throw new Error('trace emit failed')
    },
  })!
  const release = trace.observe(host)
  try {
    host.captureRaw(file, 'first', false)
    expect(host.readSource(file)).toBe('first')
    const inspect = vi.spyOn(host, 'inspectInput').mockImplementation(() => {
      throw new Error('trace inspection failed')
    })
    host.captureRaw(file, 'second', false)
    expect(host.readSource(file)).toBe('second')
    trace.input('sidecar-before', file, host)
    inspect.mockRestore()
    const failure = new Error('actual input capture failed')
    vi.spyOn(host, 'capture').mockImplementationOnce(() => {
      throw failure
    })
    expect(() => host.captureRaw(file, 'third', false)).toThrow(failure)
  }
  finally {
    release()
  }
})
