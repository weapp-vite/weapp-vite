import type { HmrProfileJsonSample } from '../../analyze/hmr'
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
