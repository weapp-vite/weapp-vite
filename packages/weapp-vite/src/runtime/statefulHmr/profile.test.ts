import type { HmrProfileJsonSample } from '../../analyze/hmr'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { attributeHmrProfile } from '../../analyze/hmr/attribution'
import { readHmrProfileLines } from '../../analyze/hmr/reader'
import { createStatefulHmrProfile, StatefulHmrProfile } from './profile'

it('records disjoint boundaries without double counting preparation that precedes commit', async () => {
  let now = 10
  const samples: HmrProfileJsonSample[] = []
  const profile = new StatefulHmrProfile({ root: '/fixture', now: () => now, emit: sample => samples.push(sample) })
  profile.source('/fixture/page.vue')
  now = 30
  const batch = profile.begin(['/fixture/page.vue'], 'delivery')
  now = 35
  batch.mark('prepareMs')
  now = 45
  batch.mark('commitQueueMs')
  now = 55
  batch.mark('commitMs')
  now = 65
  batch.mark('publishMs')
  now = 90
  batch.finish('complete')
  batch.finish('incomplete')
  await profile.close()
  expect(samples).toHaveLength(1)
  expect(samples[0]).toMatchObject({ totalMs: 80, sourceToBatchMs: 20, deliveryQueueMs: 5, prepareMs: 10, commitQueueMs: 10, commitMs: 10, publishMs: 25, correlation: 'known', completionBoundary: 'delivery-acknowledged' })
  expect(attributeHmrProfile(samples[0]!)).toMatchObject({ pipeline: 'stateful', status: 'complete', profileResidualMs: 0 })
  expect(readHmrProfileLines(JSON.stringify(samples[0])).coverage.compatible).toBe(1)
})

it('preserves unknown sources, cancellation and failure instead of counting them as successful latency', async () => {
  const samples: HmrProfileJsonSample[] = []
  const profile = new StatefulHmrProfile({ root: '/fixture', emit: sample => samples.push(sample) })
  profile.begin(['missing.vue'], 'refresh').finish('complete')
  profile.source('page.vue')
  profile.begin(['page.vue'], 'full').finish('failed')
  profile.begin(['other.vue'], 'delivery')
  await profile.close()
  expect(samples[0]).toMatchObject({ correlation: 'unknown', status: 'complete' })
  expect(samples[0]!.sourceToBatchMs).toBeUndefined()
  expect(samples.slice(1).map(sample => sample.status)).toEqual(['failed', 'incomplete'])
  expect(samples.slice(1).every(sample => sample.totalMs === undefined)).toBe(true)
  expect(readHmrProfileLines(samples.map(sample => JSON.stringify(sample)).join('\n')).coverage.incomplete).toBe(2)
})

it('does not consume the next source event when an older batch completes', () => {
  const samples: HmrProfileJsonSample[] = []
  const profile = new StatefulHmrProfile({ root: '/fixture', emit: sample => samples.push(sample) })
  profile.source('page.vue')
  const first = profile.begin(['page.vue'], 'refresh')
  profile.source('page.vue')
  first.finish('complete')
  profile.begin(['page.vue'], 'refresh').finish('complete')
  expect(samples.every(sample => sample.correlation === 'known')).toBe(true)
  expect(samples[0]!.eventId).not.toBe(samples[1]!.eventId)
})

it('keeps batch identity separate from the active transport build identity', () => {
  const samples: HmrProfileJsonSample[] = []
  let buildId: string | undefined
  const profile = new StatefulHmrProfile({ root: '/fixture', buildId: () => buildId, emit: sample => samples.push(sample) })
  profile.begin([], 'full').finish('complete')
  buildId = 'transport-generation'
  profile.begin([], 'delivery').finish('complete')
  profile.begin([], 'delivery').finish('complete')
  expect(samples.map(sample => sample.buildId)).toEqual([undefined, 'transport-generation', 'transport-generation'])
  expect(new Set(samples.map(sample => sample.batchId)).size).toBe(3)
})

it('keeps disabled observation and failing diagnostic consumers out of runtime behavior', () => {
  vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
  const now = vi.fn(() => 0)
  try {
    expect(createStatefulHmrProfile({ root: '/fixture', option: false, now })).toBeUndefined()
    expect(now).not.toHaveBeenCalled()
    const profile = new StatefulHmrProfile({ root: '/fixture', emit: () => {
      throw new Error('sink')
    }, onError: () => {
      throw new Error('logger')
    } })
    expect(() => profile.begin([], 'full').finish('complete')).not.toThrow()
    const failingIdentity = new StatefulHmrProfile({ root: '/fixture', buildId: () => {
      throw new Error('identity')
    } })
    expect(() => failingIdentity.begin([], 'full').finish('complete')).not.toThrow()
  }
  finally {
    vi.unstubAllEnvs()
  }
})

it('transfers the original clock and source to the replacement sink until full publication', async () => {
  let now = 10
  const oldSamples: HmrProfileJsonSample[] = []
  const samples: HmrProfileJsonSample[] = []
  const original = new StatefulHmrProfile({ root: '/fixture', now: () => now, emit: sample => oldSamples.push(sample), buildId: () => 'old-build' })
  original.source('app.json')
  now = 20
  const oldBatch = original.begin(['app.json'], 'delivery')
  now = 25
  oldBatch.mark('prepareMs')
  now = 40
  oldBatch.mark('commitQueueMs')
  now = 45
  const handoff = original.transfer(oldBatch)!
  handoff.validateWith(async () => {
    now = 950
    return true
  })
  oldBatch.finish('incomplete')
  await original.close()
  expect(oldSamples).toEqual([])
  const replacement = new StatefulHmrProfile({ root: '/fixture', now: () => 1_000_000, emit: sample => samples.push(sample), buildId: () => 'new-build' })
  const batch = replacement.adopt(handoff)!
  expect(replacement.adopt(handoff)).toBeUndefined()
  expect(original.transfer(oldBatch)).toBeUndefined()
  await handoff.cancel()
  expect(samples).toEqual([])
  now = 90
  await batch.finishPublished()
  await replacement.close()
  expect(oldSamples).toEqual([])
  expect(samples).toHaveLength(1)
  expect(samples[0]).toMatchObject({ profileMode: 'full', completionBoundary: 'output-published', status: 'complete', sourceToBatchMs: 10, snapshotBuildMs: 25, snapshotPublishMs: 45, totalMs: 80, buildId: 'new-build', sourceEvents: [{ file: 'app.json', receivedAtMs: 10 }] })
  expect(samples[0]!.batchId).toBe(`${samples[0]!.sessionId}:1`)
  expect(attributeHmrProfile(samples[0]!)).toMatchObject({ status: 'complete', profileResidualMs: 0 })
})

it.each(['incomplete', 'failed'] as const)('flushes an unclaimed %s handoff after the old session has closed', async (status) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'profile-handoff-'))
  try {
    const file = path.join(root, 'profile.jsonl')
    const profile = new StatefulHmrProfile({ root }, file)
    profile.source('app.json')
    const handoff = profile.transfer(profile.begin(['app.json'], 'refresh'))!
    await profile.close()
    await Promise.all([handoff.cancel(status), handoff.cancel(status)])
    const rows = (await readFile(file, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as HmrProfileJsonSample)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status, profileMode: 'full' })
    expect(rows[0]!.totalMs).toBeUndefined()
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('cancels an adopted profile on replacement close and ignores its late publication', async () => {
  const samples: HmrProfileJsonSample[] = []
  const original = new StatefulHmrProfile({ root: '/fixture' })
  original.source('app.json')
  const handoff = original.transfer(original.begin(['app.json'], 'delivery'))!
  await original.close()
  const replacement = new StatefulHmrProfile({ root: '/fixture', emit: sample => samples.push(sample) })
  const batch = replacement.adopt(handoff)!
  await replacement.close()
  batch.finish('complete')
  await handoff.cancel()
  expect(samples).toHaveLength(1)
  expect(samples[0]).toMatchObject({ status: 'incomplete', completionBoundary: 'output-published' })
  expect(samples[0]!.totalMs).toBeUndefined()
})

it.each(['close', 'failure'] as const)('preserves terminal ownership while publication validation awaits: %s', async (mode) => {
  const samples: HmrProfileJsonSample[] = []
  const owner = new StatefulHmrProfile({ root: '/fixture' })
  owner.source('page.json')
  const handoff = owner.transfer(owner.begin(['page.json'], 'delivery'))!
  const validated = Promise.withResolvers<boolean>()
  handoff.validateWith(() => validated.promise)
  const replacement = new StatefulHmrProfile({ root: '/fixture', emit: sample => samples.push(sample) })
  const publication = replacement.adopt(handoff)!.finishPublished()
  if (mode === 'close') {
    await replacement.close()
    validated.resolve(true)
  }
  else {
    validated.reject(new Error('source validation failed'))
  }
  await publication
  await replacement.close()
  expect(samples).toHaveLength(1)
  expect(samples[0]).toMatchObject({ status: mode === 'close' ? 'incomplete' : 'failed' })
  expect(samples[0]!.totalMs).toBeUndefined()
})
