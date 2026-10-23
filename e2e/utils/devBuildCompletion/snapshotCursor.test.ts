import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { nativePublicationHash } from '../nativePublication/files'
import { captureSourcePublication } from './sourcePublication'

const profile = vi.hoisted(() => ({ content: '' }))
vi.mock('node:fs', () => ({ readFileSync: () => profile.content }))
vi.mock('node:fs/promises', () => ({ readFile: () => Promise.resolve(profile.content) }))

const source = path.join(tmpdir(), 'snapshot-publication', 'page.wxml')

afterEach(() => {
  profile.content = ''
})

function sourceEnd(batchId: string) {
  return `${JSON.stringify({
    schemaVersion: 1,
    pipeline: 'stateful',
    status: 'complete',
    sessionId: 'snapshot-session',
    batchId,
    clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
    sourceEvents: [{ file: source, eventId: batchId, receivedAtMs: performance.now() + 1_000 }],
  })}\n`
}

it.each(['truncate', 'replace'] as const)('preserves snapshot write-cursor validation after profile %s', async (variant) => {
  const publication = captureSourcePublication({ files: [source], profilePath: 'profile.jsonl' }, true)
  profile.content = sourceEnd('earlier-batch')
  const cursor = { offset: profile.content.length, prefixHash: nativePublicationHash(profile.content) }
  profile.content = variant === 'truncate' ? '' : sourceEnd('replaced-batch')
  await expect(publication.check(new AbortController().signal, cursor)).rejects.toThrow('truncated or replaced')
})

it('does not reuse a matching snapshot END before the native write cursor', async () => {
  const publication = captureSourcePublication({ files: [source], profilePath: 'profile.jsonl' }, true)
  profile.content = sourceEnd('earlier-batch')
  const cursor = { offset: profile.content.length, prefixHash: nativePublicationHash(profile.content) }
  expect(await publication.check(new AbortController().signal, cursor)).toBe(false)
  profile.content += sourceEnd('current-batch')
  expect(await publication.check(new AbortController().signal, cursor)).toBe(true)
})

it('rejects an empty set of native evidence instead of treating it as snapshot completion', async () => {
  const publication = captureSourcePublication({ files: [source], profilePath: 'profile.jsonl' }, true)
  profile.content = sourceEnd('current-batch')
  expect(await publication.check(new AbortController().signal, [])).toBe(false)
})
