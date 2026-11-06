import type { HmrProfileJsonSample } from '../../packages/weapp-vite/src/analyze/hmr'
import type { ClassicPublicationObservation } from './classicPublicationBarrier'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { nativePublicationHash } from '../../e2e/utils/nativePublication/files'
import { selectWorkspaceHmrProfileSample, waitForWorkspaceHmrProfileSample } from './profile'

const file = path.resolve('fixture/src/pages/index.vue')
const event = { eventId: 'save-event', file, receivedAtMs: 10 }
const formal: HmrProfileJsonSample = {
  schemaVersion: 1,
  status: 'complete',
  pipeline: 'standard',
  sessionId: 'session',
  buildId: 'session:9',
  batchId: 'save-batch',
  correlation: 'known',
  clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: 1000 },
  sourceEvents: [event],
  file,
  totalMs: 7862,
}
const jsonl = (...samples: unknown[]) => `${samples.map(sample => JSON.stringify(sample)).join('\n')}\n`
function publication(prefix = '', buildId = 'session:9', batchId = 'save-batch', eventId = 'save-event'): ClassicPublicationObservation {
  return {
    outputOffset: 20,
    profileCursor: {
      offset: prefix.length,
      prefixHash: nativePublicationHash(prefix),
      identity: { buildId, batchId, sourceEvents: [{ eventId, file }] },
    },
  }
}

it('selects the receipt-backed update after an internal same-path build without hiding a real threshold failure', () => {
  const internal = { ...formal, buildId: 'session:8', batchId: 'internal', sourceEvents: [], correlation: 'unknown', totalMs: 11299 }
  const content = jsonl(internal, formal)
  expect(selectWorkspaceHmrProfileSample(content, file, publication())).toEqual(formal)
  expect(selectWorkspaceHmrProfileSample(content, file, publication())!.totalMs).toBeGreaterThan(6000)
})

it.each([
  { buildId: 'session:8' },
  { batchId: 'other-batch' },
  { correlation: 'unknown' },
  { sourceEvents: [] },
  { sourceEvents: [{ ...event, eventId: 'other-save' }] },
  { sourceEvents: [{ ...event, file: path.resolve('other/src/pages/index.vue') }] },
  { pipeline: 'stateful' },
  { schemaVersion: undefined },
  { schemaVersion: 99 },
  { status: 'failed' },
  { status: 'incomplete' },
  { totalMs: -1 },
  { clock: undefined },
  { clock: { ...formal.clock, timeOrigin: 0 } },
])('rejects a same-path sample outside the current formal source identity: %j', (override) => {
  expect(selectWorkspaceHmrProfileSample(jsonl({ ...formal, ...override }), file, publication())).toBeUndefined()
})

it('requires the native source identity instead of filling attribution from the scenario', () => {
  expect(() => selectWorkspaceHmrProfileSample(jsonl(formal), file)).toThrow('native publication source identity')
  expect(() => selectWorkspaceHmrProfileSample(jsonl(formal), file, { outputOffset: 20, profileCursor: { offset: 0, prefixHash: nativePublicationHash('') } })).toThrow('native publication source identity')
  expect(() => selectWorkspaceHmrProfileSample(jsonl(formal), path.resolve('other/src/pages/index.vue'), publication())).toThrow('native publication source identity')
})

it('keeps source-event attribution without inventing legacy paths or counts', () => {
  const batch = { ...formal, file: undefined }
  const selected = selectWorkspaceHmrProfileSample(jsonl(batch), file, publication())!
  expect(selected.sourceEvents).toEqual([event])
  for (const field of ['file', 'relativeFile', 'sourceRootFile', 'dirtyCount', 'pendingCount', 'emittedCount']) {
    expect(selected).not.toHaveProperty(field)
  }
})

it('keeps restore and update receipts separate even when every record has the same source path', () => {
  const updated = jsonl(formal)
  const restore = { ...formal, buildId: 'session:10', batchId: 'restore-batch', sourceEvents: [{ ...event, eventId: 'restore-event' }], totalMs: 6337 }
  const restored = updated + jsonl({ ...formal, buildId: 'internal-restore', correlation: 'unknown', sourceEvents: [] }, restore)
  expect(selectWorkspaceHmrProfileSample(restored, file, publication())).toEqual(formal)
  expect(selectWorkspaceHmrProfileSample(restored, file, publication(updated, 'session:10', 'restore-batch', 'restore-event'))).toEqual(restore)
  expect(selectWorkspaceHmrProfileSample(updated + jsonl(formal), file, publication(updated, 'session:10', 'restore-batch', 'restore-event'))).toBeUndefined()
})

it('uses the matching source receipt when the final selected write belongs to another source', () => {
  const current = publication()
  const receipt = publication('', 'other-build', 'other-batch', 'other-event')
  receipt.profileCursor!.identity!.sourceEvents[0]!.file = path.resolve('fixture/src/other.vue')
  receipt.sourcePublications = [{ cursor: { ...current.profileCursor!, identity: current.profileCursor!.identity! }, files: [file] }]
  expect(selectWorkspaceHmrProfileSample(jsonl(formal), file, receipt)).toEqual(formal)
})

it('prefers the actual selected write identity over earlier same-source receipts and later unrelated profiles', () => {
  const earlier = { ...formal, buildId: 'session:8', batchId: 'earlier', sourceEvents: [{ ...event, eventId: 'earlier-event' }], totalMs: 1 }
  const receipt = publication()
  const previous = publication('', 'session:8', 'earlier', 'earlier-event')
  receipt.sourcePublications = [{ cursor: { ...previous.profileCursor!, identity: previous.profileCursor!.identity! }, files: [file] }]
  const later = { ...formal, buildId: 'session:10', batchId: 'later', sourceEvents: [{ ...event, eventId: 'later-event' }], totalMs: 2 }
  expect(selectWorkspaceHmrProfileSample(jsonl(earlier, formal, later), file, receipt)).toEqual(formal)
})

it('rejects replaced or truncated profile bytes and does not parse an unfinished line', () => {
  const prefix = jsonl({ diagnostic: 'before native write' })
  const receipt = publication(prefix)
  expect(() => selectWorkspaceHmrProfileSample(jsonl(formal), file, receipt)).toThrow('truncated or replaced')
  expect(selectWorkspaceHmrProfileSample(prefix + JSON.stringify(formal), file, receipt)).toBeUndefined()
  expect(selectWorkspaceHmrProfileSample(prefix + jsonl(formal), file, receipt)).toEqual(formal)
})

it('normalizes Windows source separators while retaining exact event and source ownership', () => {
  const windowsFile = 'C:\\fixture\\src\\page.vue'
  const receipt = publication()
  receipt.profileCursor!.identity!.sourceEvents[0]!.file = windowsFile
  const sample = { ...formal, sourceEvents: [{ ...event, file: 'c:/fixture/src/page.vue' }] }
  expect(selectWorkspaceHmrProfileSample(jsonl(sample), windowsFile, receipt)).toEqual(sample)
})

it('reads the formal receipt sample within the existing phase budget and fails absent identity before I/O', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-hmr-profile-'))
  const profile = path.join(root, 'profile.jsonl')
  try {
    await expect(waitForWorkspaceHmrProfileSample(profile, file, undefined, 5000)).rejects.toThrow('native publication source identity')
    await writeFile(profile, jsonl(formal))
    await expect(waitForWorkspaceHmrProfileSample(profile, file, publication(), 5000)).resolves.toEqual(formal)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
