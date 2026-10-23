import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createDevBuildCompletion } from './devBuildCompletion'
import { nativePublicationHash } from './nativePublication/files'

const profile = vi.hoisted(() => ({ content: '' }))
vi.mock('node:fs', () => ({ readFileSync: () => profile.content }))
vi.mock('node:fs/promises', () => ({ readFile: () => Promise.resolve(profile.content) }))

const source = path.join(tmpdir(), 'native-identity', 'page.wxml')
const secondSource = path.join(tmpdir(), 'native-identity', 'component.wxml')
const identity = {
  buildId: 'current-build',
  batchId: 'current-batch',
  sourceEvents: [{ eventId: 'current-event', file: source }],
}

afterEach(() => {
  vi.useRealTimers()
  profile.content = ''
})

function sourceRecord(epoch: number, overrides: Record<string, unknown> = {}) {
  const timeOrigin = performance.timeOrigin - 1_000
  return `${JSON.stringify({
    schemaVersion: 1,
    pipeline: 'standard',
    sessionId: 'current-session',
    buildId: identity.buildId,
    batchId: identity.batchId,
    totalMs: 1,
    status: 'complete',
    correlation: 'known',
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin },
    sourceEvents: [{ ...identity.sourceEvents[0], event: 'update', receivedAtMs: epoch - timeOrigin }],
    ...overrides,
  })}\n`
}

function capture(files = [source], publicationIdentity = identity) {
  const previous = profile.content
  const cursor = {
    offset: previous.length,
    prefixHash: nativePublicationHash(previous),
    identity: publicationIdentity,
  }
  const completion = createDevBuildCompletion({
    getOutput: () => '',
    waitFor: async <T>(task: Promise<T>) => task,
  }, { source: { files, profilePath: 'profile.jsonl' } })
  return { completion, cursor }
}

async function finish(completion: ReturnType<typeof createDevBuildCompletion>, cursor: ReturnType<typeof capture>['cursor']) {
  const result = completion.wait(100, cursor).then(() => undefined, (error: unknown) => error)
  await vi.advanceTimersByTimeAsync(100)
  return result
}

it('binds a post-write END to the native build and batch when the child epoch precedes the parent capture', async () => {
  vi.useFakeTimers()
  const childEpoch = performance.timeOrigin + performance.now() - 5
  const { completion, cursor } = capture()
  profile.content += sourceRecord(childEpoch)
  expect(await finish(completion, cursor)).toBeUndefined()
  expect(vi.getTimerCount()).toBe(0)
})

it('requires matching native event identities for every requested source', async () => {
  vi.useFakeTimers()
  const childEpoch = performance.timeOrigin + performance.now() - 5
  const sourceEvents = [...identity.sourceEvents, { eventId: 'component-event', file: secondSource }]
  const { completion, cursor } = capture([source, secondSource], { ...identity, sourceEvents })
  profile.content += sourceRecord(childEpoch, {
    sourceEvents: sourceEvents.map(event => ({ ...event, event: 'update', receivedAtMs: childEpoch - (performance.timeOrigin - 1_000) })),
  })
  expect(await finish(completion, cursor)).toBeUndefined()
})

it('rejects a matching END preceding the frozen native write cursor', async () => {
  vi.useFakeTimers()
  profile.content = sourceRecord(performance.timeOrigin + performance.now() + 1_000)
  const { completion, cursor } = capture()
  expect(await finish(completion, cursor)).toEqual(expect.objectContaining({ message: expect.stringContaining('Timed out waiting for current dev build') }))
})

it.each([
  { label: 'build', overrides: { buildId: 'earlier-build' } },
  { label: 'batch', overrides: { batchId: 'earlier-batch' } },
  { label: 'event', overrides: { eventId: 'earlier-event' } },
  { label: 'source', overrides: { file: secondSource } },
  { label: 'empty session', overrides: { sessionId: '' } },
  { label: 'missing session', overrides: { sessionId: undefined } },
  { label: 'unknown correlation', overrides: { correlation: 'unknown' } },
  { label: 'incomplete END', overrides: { status: 'incomplete' } },
])('rejects a newer clock value with mismatched $label evidence', async ({ label, overrides }) => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now() + 1_000
  const { completion, cursor } = capture()
  const eventOverrides = label === 'event' || label === 'source'
    ? { sourceEvents: [{ ...identity.sourceEvents[0], ...overrides, event: 'update', receivedAtMs: epoch - (performance.timeOrigin - 1_000) }] }
    : overrides
  profile.content += sourceRecord(epoch, eventOverrides)
  expect(await finish(completion, cursor)).toEqual(expect.objectContaining({ message: expect.stringContaining('Timed out waiting for current dev build') }))
})

it('rejects a requested source whose event identity belongs to another source in the same batch', async () => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now() + 1_000
  const { completion, cursor } = capture([source, secondSource], {
    ...identity,
    sourceEvents: [...identity.sourceEvents, { eventId: 'component-event', file: secondSource }],
  })
  profile.content += sourceRecord(epoch, {
    sourceEvents: [
      { ...identity.sourceEvents[0], event: 'update', receivedAtMs: epoch - (performance.timeOrigin - 1_000) },
      { eventId: 'current-event', file: secondSource, event: 'update', receivedAtMs: epoch - (performance.timeOrigin - 1_000) },
    ],
  })
  expect(await finish(completion, cursor)).toEqual(expect.objectContaining({ message: expect.stringContaining('Timed out waiting for current dev build') }))
})

it('preserves the matching native generation failure even when its child epoch precedes capture', async () => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now() - 5
  const { completion, cursor } = capture()
  profile.content += sourceRecord(epoch, { status: 'failed' })
  expect(await finish(completion, cursor)).toEqual(expect.objectContaining({ message: 'Current source publication failed; preserve the original dev build error' }))
})

it('does not let a failed different native batch poison the current successful END', async () => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now()
  const { completion, cursor } = capture()
  profile.content += sourceRecord(epoch + 1_000, { batchId: 'earlier-batch', status: 'failed' })
  profile.content += sourceRecord(epoch - 5)
  expect(await finish(completion, cursor)).toBeUndefined()
})

it.each(['truncate', 'replace'])('rejects native identity evidence after profile %s invalidates its write cursor', async (mode) => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now()
  profile.content = sourceRecord(epoch + 1_000, { buildId: 'earlier-build' })
  const { completion, cursor } = capture()
  profile.content = mode === 'truncate' ? '' : sourceRecord(epoch + 1_000, { buildId: 'replacement-build' })
  profile.content += sourceRecord(epoch - 5)
  expect(await finish(completion, cursor)).toEqual(expect.objectContaining({ message: 'HMR profile was truncated or replaced after the native byte write' }))
})

it('preserves a matching failure appended after a matching native success', async () => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now() - 5
  const { completion, cursor } = capture()
  profile.content += sourceRecord(epoch)
  profile.content += sourceRecord(epoch, { status: 'failed' })
  expect(await finish(completion, cursor)).toEqual(expect.objectContaining({ message: 'Current source publication failed; preserve the original dev build error' }))
})

it('does not confuse a failed earlier event for the same native source with the current END', async () => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now()
  const { completion, cursor } = capture()
  profile.content += sourceRecord(epoch + 1_000, {
    status: 'failed',
    sourceEvents: [{ eventId: 'earlier-event', file: source, event: 'update', receivedAtMs: epoch + 1_000 - (performance.timeOrigin - 1_000) }],
  })
  profile.content += sourceRecord(epoch - 5)
  expect(await finish(completion, cursor)).toBeUndefined()
})

it('normalizes Windows drive letters and separators for both native and END event identities', async () => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now() - 5
  const { completion, cursor } = capture(['c:/project/src/page.wxml'], {
    ...identity,
    sourceEvents: [{ eventId: 'windows-event', file: 'C:\\project\\src\\page.wxml' }],
  })
  profile.content += sourceRecord(epoch, {
    sourceEvents: [{ eventId: 'windows-event', file: 'c:/project/src/./page.wxml', event: 'update', receivedAtMs: epoch - (performance.timeOrigin - 1_000) }],
  })
  expect(await finish(completion, cursor)).toBeUndefined()
})

it('retains strict source-clock protection when the native cursor has no identity', async () => {
  vi.useFakeTimers()
  const epoch = performance.timeOrigin + performance.now() - 5
  const { completion, cursor } = capture()
  const { identity: _identity, ...legacyCursor } = cursor
  profile.content += sourceRecord(epoch)
  const result = completion.wait(100, legacyCursor).then(() => undefined, (error: unknown) => error)
  await vi.advanceTimersByTimeAsync(100)
  expect(await result).toEqual(expect.objectContaining({ message: expect.stringContaining('Timed out waiting for current dev build') }))
})
