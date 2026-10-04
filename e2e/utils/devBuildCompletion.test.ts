import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createDevBuildCompletion } from './devBuildCompletion'

const profile = vi.hoisted(() => ({
  content: '',
  read: undefined as (() => Promise<string>) | undefined,
  signal: undefined as AbortSignal | undefined,
}))
vi.mock('node:fs', () => ({ readFileSync: () => profile.content }))
vi.mock('node:fs/promises', () => ({
  readFile: (_file: string, options: { signal: AbortSignal }) => {
    profile.signal = options.signal
    return profile.read?.() ?? Promise.resolve(profile.content)
  },
}))

afterEach(() => {
  vi.useRealTimers()
  profile.content = ''
  profile.read = undefined
  profile.signal = undefined
})

function sourceRecord(file: string, receivedAtEpochMs: number, overrides: Record<string, unknown> = {}) {
  const timeOrigin = performance.timeOrigin - 1_000
  return JSON.stringify({
    schemaVersion: 1,
    pipeline: 'standard',
    sessionId: 'test-session',
    buildId: 'test-build',
    batchId: 'test-batch',
    totalMs: 1,
    status: 'complete',
    correlation: 'known',
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin },
    sourceEvents: [{ eventId: 'test-event', event: 'update', file, receivedAtMs: receivedAtEpochMs - timeOrigin }],
    ...overrides,
  })
}

function createProcess() {
  const exit = Promise.withResolvers<never>()
  let output = 'restart begun\npublication complete\n'
  return {
    getOutput: () => output,
    append: (text: string) => { output += text },
    waitFor: <T>(task: Promise<T>) => Promise.race([task, exit.promise]),
    exit: (error: Error) => exit.reject(error),
  }
}

it('waits beyond old completions and partially visible output until this publication finishes', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { started: 'restart begun', completed: 'publication complete' })
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  dev.append('restart begun\nnew page and control file visible\n')
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  dev.append('publication com')
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  dev.append('plete\n')
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(finished).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('does not use an intermediate completion when another restart has already begun', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { started: 'restart begun', completed: 'publication complete' })
  dev.append('restart begun\npublication complete\nrestart begun\n')
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  dev.append('publication complete\n')
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(vi.getTimerCount()).toBe(0)
})

it('retains a completion that arrived after capture but before waiting', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { completed: 'publication complete' })
  dev.append('publication complete\n')
  await publication.wait()
  expect(vi.getTimerCount()).toBe(0)
})

it('fails and removes polling when the process exits before publication', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { completed: 'publication complete' })
  const error = new Error('build process exited')
  const rejected = expect(publication.wait()).rejects.toBe(error)
  dev.append('build failed\n')
  dev.exit(error)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps failed builds failed when no completion arrives within the original deadline', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { completed: 'publication complete' })
  const rejected = expect(publication.wait(100)).rejects.toThrow('Timed out waiting for current dev build')
  dev.append('build failed\n')
  await vi.advanceTimersByTimeAsync(100)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it('rejects late script completion and an older event for the same template before current publication', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const template = path.join(tmpdir(), 'dev-publication', 'template.html')
  const capturedAtEpochMs = performance.timeOrigin + performance.now()
  const publication = createDevBuildCompletion(dev, {
    completed: 'publication complete',
    source: { file: template, profilePath: 'profile.jsonl' },
  })
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  dev.append('publication complete\n')
  profile.content += `${sourceRecord(path.join(tmpdir(), 'dev-publication', 'setup.ts'), capturedAtEpochMs + 1)}\n`
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)

  profile.content += `${sourceRecord(template, capturedAtEpochMs - 1)}\n`
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)

  const current = sourceRecord(template, capturedAtEpochMs + 1)
  profile.content += current.slice(0, -3)
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  profile.content += `${current.slice(-3)}\n`
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(finished).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it.each([
  { status: 'failed' },
  { status: 'incomplete' },
  { correlation: 'unknown' },
  { batchId: undefined },
  { sourceEvents: [] },
  { clock: { timeOrigin: 'invalid', durations: 'performance.now' } },
])('keeps the original deadline when the source record is not a completed correlated batch: %j', async (overrides) => {
  vi.useFakeTimers()
  const dev = createProcess()
  const file = path.join(tmpdir(), 'dev-publication', 'template.html')
  const capturedAtEpochMs = performance.timeOrigin + performance.now()
  const publication = createDevBuildCompletion(dev, {
    completed: 'publication complete',
    source: { file, profilePath: 'profile.jsonl' },
  })
  const rejected = expect(publication.wait(100)).rejects.toThrow('Timed out waiting for current dev build')
  dev.append('publication complete\n')
  profile.content += `${sourceRecord(file, capturedAtEpochMs + 1, overrides)}\n`
  await vi.advanceTimersByTimeAsync(100)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it('normalizes Windows source paths and ignores all records preceding the profile cursor', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const capturedAtEpochMs = performance.timeOrigin + performance.now()
  profile.content = `${sourceRecord('C:\\project\\src\\template.html', capturedAtEpochMs + 1)}\r\n`
  const publication = createDevBuildCompletion(dev, {
    completed: 'publication complete',
    source: { file: 'c:/project/src/template.html', profilePath: 'profile.jsonl' },
  })
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  dev.append('publication complete\n')
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  profile.content += `${sourceRecord('C:\\project\\src\\template.html', capturedAtEpochMs + 1)}\r\n`
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(finished).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('rejects a numeric overflow in receivedAtMs instead of accepting it as a future event', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const file = path.join(tmpdir(), 'dev-publication', 'template.html')
  const publication = createDevBuildCompletion(dev, {
    completed: 'publication complete',
    source: { file, profilePath: 'profile.jsonl' },
  })
  const rejected = expect(publication.wait(100)).rejects.toThrow('Timed out waiting for current dev build')
  const record = sourceRecord(file, performance.timeOrigin + performance.now() + 1)
    .replace(/"receivedAtMs":[\d.]+/, '"receivedAtMs":1e999')
  expect(record).toContain('"receivedAtMs":1e999')
  profile.content = `${record}\n`
  dev.append('publication complete\n')
  await vi.advanceTimersByTimeAsync(100)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['truncate', 'replace'])('recovers the source cursor after profile %s without accepting old events', async (mode) => {
  vi.useFakeTimers()
  const dev = createProcess()
  const file = path.join(tmpdir(), 'dev-publication', 'template.html')
  const capturedAtEpochMs = performance.timeOrigin + performance.now()
  const old = `${sourceRecord(file, capturedAtEpochMs - 1)}\n`
  profile.content = old.repeat(3)
  const publication = createDevBuildCompletion(dev, {
    completed: 'publication complete',
    source: { file, profilePath: 'profile.jsonl' },
  })
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  dev.append('publication complete\n')
  profile.content = mode === 'truncate' ? '' : `${sourceRecord(file, capturedAtEpochMs - 2)}\n`
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  profile.content += `${sourceRecord(file, capturedAtEpochMs + 1)}\n`
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(finished).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['resolve', 'reject'])('aborts an in-flight profile read on process exit and ignores its late %s', async (mode) => {
  vi.useFakeTimers()
  const dev = createProcess()
  const read = Promise.withResolvers<string>()
  profile.read = vi.fn(() => read.promise)
  const publication = createDevBuildCompletion(dev, {
    completed: 'publication complete',
    source: { file: path.join(tmpdir(), 'template.html'), profilePath: 'profile.jsonl' },
  })
  const error = new Error('dev process exited during profile read')
  const rejected = expect(publication.wait()).rejects.toBe(error)
  dev.append('publication complete\n')
  await vi.advanceTimersByTimeAsync(25)
  expect(profile.read).toHaveBeenCalledTimes(1)
  dev.exit(error)
  await rejected
  expect(profile.signal?.aborted).toBe(true)
  if (mode === 'resolve') {
    read.resolve('')
  }
  else {
    read.reject(new Error('late profile error'))
  }
  await vi.advanceTimersByTimeAsync(100)
  expect(profile.read).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
