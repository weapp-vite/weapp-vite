import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createDevBuildCompletion } from './devBuildCompletion'
import { NATIVE_BATCH_EXTENSIONS } from './nativeBatchProject'
import { NATIVE_BATCH_SETTLEMENT_PREFIX } from './nativeBatchSettlementPlugin'

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

const snapshotFiles = NATIVE_BATCH_EXTENSIONS.map(extension => `src/pages/index/index.${extension}`)
const snapshotSource = { files: snapshotFiles, profilePath: 'profile.jsonl' }

function snapshotSourceRecord(file: string, receivedAtEpochMs = performance.timeOrigin + performance.now() + 1, status = 'incomplete') {
  return `${sourceRecord(file, receivedAtEpochMs, {
    pipeline: 'stateful',
    status,
    totalMs: status === 'complete' ? 1 : undefined,
    elapsedMs: status === 'complete' ? undefined : 1,
  })}\n`
}

function snapshotRecord(stage: string, details: Record<string, unknown> = {}) {
  return `[stateful-hmr-snapshot] ${JSON.stringify({ sessionId: 'snapshot-session', stage, ...details })}\n`
}

function settlementRecord(id: string, details: Record<string, unknown> = {}) {
  return `${NATIVE_BATCH_SETTLEMENT_PREFIX}${JSON.stringify({ id, status: 'complete', ...details })}\n`
}

it('waits for owner settlement after every notification despite superseded disk/control and active publication', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const settled = Promise.withResolvers<void>()
  const requestSettlement = vi.fn((id: string) => {
    void settled.promise.then(() => dev.append(settlementRecord(id)))
  })
  const publication = createDevBuildCompletion(dev, { snapshot: { ...snapshotSource, requestSettlement } })
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  for (const file of snapshotFiles.slice(0, -1)) {
    profile.content += snapshotSourceRecord(file)
  }
  dev.append('matching four files and new control visible\npublication complete\n')
  dev.append(snapshotRecord('write-end', { batchId: 6, status: 'resolved' }))
  dev.append(snapshotRecord('batch-end', { batchId: 6, status: 'resolved', superseded: true }))
  await vi.advanceTimersByTimeAsync(50)
  expect(requestSettlement).not.toHaveBeenCalled()
  expect(finished).toBe(false)

  profile.content += snapshotSourceRecord(snapshotFiles.at(-1)!, undefined, 'complete')
  dev.append(snapshotRecord('batch-start', { batchId: 7, files: snapshotFiles }))
  await vi.advanceTimersByTimeAsync(25)
  expect(requestSettlement).toHaveBeenCalledTimes(1)
  expect(finished).toBe(false)
  // 即使发布记录已经完整，宿主仍可能正在释放准备资源或结束调度器。
  dev.append(snapshotRecord('batch-end', { batchId: 7, status: 'resolved', superseded: false }))
  dev.append(snapshotRecord('source-after', { batchId: 7 }))
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  expect(requestSettlement).toHaveBeenCalledTimes(1)

  settled.resolve()
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(finished).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('rejects a buffered prior edit as the missing source and retains the 30 second total deadline', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const capturedAt = performance.timeOrigin + performance.now()
  profile.content = snapshotFiles.map(file => snapshotSourceRecord(file, capturedAt - 2)).join('')
  const requestSettlement = vi.fn()
  const publication = createDevBuildCompletion(dev, { snapshot: { ...snapshotSource, requestSettlement } })
  const rejected = expect(publication.wait()).rejects.toThrow('Timed out waiting for current dev build')
  for (const file of snapshotFiles.slice(1)) {
    profile.content += snapshotSourceRecord(file)
  }
  // 旧事件在捕获后才写入 profile / stdout；到达游标不能代替实际通知的高精度时间。
  profile.content += snapshotSourceRecord(snapshotFiles[0]!, capturedAt - 0.5)
  dev.append(snapshotRecord('source-change', { file: snapshotFiles[0] }))
  dev.append(settlementRecord('previous-edit'))
  await vi.advanceTimersByTimeAsync(29_999)
  expect(requestSettlement).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it('uses a new nonce for each edit and accepts only complete matching acknowledgements', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const requestSettlement = vi.fn<(id: string) => void>()
  const first = createDevBuildCompletion(dev, { snapshot: { ...snapshotSource, requestSettlement } })
  for (const file of snapshotFiles) {
    profile.content += snapshotSourceRecord(file)
  }
  const firstWait = first.wait()
  await vi.advanceTimersByTimeAsync(25)
  const firstId = requestSettlement.mock.calls[0]![0]
  dev.append(settlementRecord(firstId))
  await vi.advanceTimersByTimeAsync(25)
  await firstWait

  const second = createDevBuildCompletion(dev, { snapshot: { ...snapshotSource, requestSettlement } })
  let finished = false
  const secondWait = second.wait().then(() => {
    finished = true
  })
  const notifications = snapshotFiles.map(file => snapshotSourceRecord(file)).join('')
  profile.content += notifications.slice(0, -1)
  await vi.advanceTimersByTimeAsync(25)
  expect(requestSettlement).toHaveBeenCalledTimes(1)
  profile.content += '\n'
  await vi.advanceTimersByTimeAsync(25)
  expect(requestSettlement).toHaveBeenCalledTimes(2)
  const secondId = requestSettlement.mock.calls[1]![0]
  expect(secondId).not.toBe(firstId)
  dev.append(settlementRecord(firstId))
  await vi.advanceTimersByTimeAsync(25)
  expect(finished).toBe(false)
  const acknowledgement = settlementRecord(secondId)
  dev.append(acknowledgement.slice(0, -1))
  await vi.advanceTimersByTimeAsync(25)
  expect(finished).toBe(false)
  dev.append('\n')
  await vi.advanceTimersByTimeAsync(25)
  await secondWait
  expect(finished).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it.each([
  { reply: (id: string) => settlementRecord(id, { status: 'failed', error: 'native output failed' }), error: 'native output failed' },
  { reply: () => `${NATIVE_BATCH_SETTLEMENT_PREFIX}{broken}\n`, error: /JSON/ },
  { reply: (id: string) => settlementRecord(id, { status: 'active' }), error: 'Invalid native batch settlement acknowledgement' },
  { reply: (id: string) => settlementRecord(id, { id: undefined }), error: 'Invalid native batch settlement acknowledgement' },
])('rejects failed or malformed settlement responses without accepting visible output: $error', async ({ reply, error }) => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, {
    snapshot: { ...snapshotSource, requestSettlement: id => dev.append(reply(id)) },
  })
  for (const file of snapshotFiles) {
    profile.content += snapshotSourceRecord(file)
  }
  const rejected = expect(publication.wait()).rejects.toThrow(error)
  await vi.advanceTimersByTimeAsync(25)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it('fails a requested settlement on child exit and ignores a late acknowledgement', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const requestSettlement = vi.fn<(id: string) => void>()
  const publication = createDevBuildCompletion(dev, { snapshot: { ...snapshotSource, requestSettlement } })
  for (const file of snapshotFiles) {
    profile.content += snapshotSourceRecord(file)
  }
  const error = new Error('child exited during native publication')
  const rejected = expect(publication.wait()).rejects.toBe(error)
  await vi.advanceTimersByTimeAsync(25)
  expect(requestSettlement).toHaveBeenCalledTimes(1)
  dev.exit(error)
  await rejected
  dev.append(settlementRecord(requestSettlement.mock.calls[0]![0]))
  await vi.advanceTimersByTimeAsync(100)
  expect(requestSettlement).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['before-request', 'after-request'])('rejects a failed current source even if the owner would acknowledge drained work: %s', async (when) => {
  vi.useFakeTimers()
  const dev = createProcess()
  const requestSettlement = vi.fn<(id: string) => void>()
  const publication = createDevBuildCompletion(dev, { snapshot: { ...snapshotSource, requestSettlement } })
  for (const file of snapshotFiles) {
    profile.content += snapshotSourceRecord(file)
  }
  if (when === 'before-request') {
    profile.content += snapshotSourceRecord(snapshotFiles[0]!, undefined, 'failed')
  }
  const rejected = expect(publication.wait()).rejects.toThrow('Native batch publication failed for current source')
  await vi.advanceTimersByTimeAsync(25)
  if (when === 'after-request') {
    expect(requestSettlement).toHaveBeenCalledTimes(1)
    profile.content += snapshotSourceRecord(snapshotFiles[0]!, undefined, 'failed')
    dev.append(settlementRecord(requestSettlement.mock.calls[0]![0]))
    await vi.advanceTimersByTimeAsync(25)
  }
  else {
    expect(requestSettlement).not.toHaveBeenCalled()
  }
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})
