import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { expect, it } from 'vitest'
import { analyzeHmrProfile } from '../hmr'

it('analyzes valid records around malformed enums without counting their timings', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hmr-profile-enums-'))
  const profilePath = path.join(root, 'profile.jsonl')
  const complete = { schemaVersion: 1, status: 'complete', totalMs: 1000 }
  try {
    await fs.writeFile(profilePath, [
      { totalMs: 20 },
      { ...complete, pipeline: ['stateful'] },
      { ...complete, profileMode: ['delivery'] },
      { ...complete, completionBoundary: ['output-published'] },
      { ...complete, pipeline: { toString: null } },
      { ...complete, sourceEvents: [{ eventId: 'event-1', event: ['update'], receivedAtMs: 1 }] },
      { ...complete, sourceEvents: [{ eventId: 'event-2', event: { toString: null }, receivedAtMs: 2 }] },
      { ...complete, totalMs: 40, pipeline: 'stateful', profileMode: 'delivery' },
    ].map(value => JSON.stringify(value)).join('\n'))

    const result = await analyzeHmrProfile({ profilePath })
    expect(result.sampleCount).toBe(2)
    expect(result.skippedLineCount).toBe(6)
    expect(result.inputCoverage).toEqual({ legacy: 1, compatible: 1, incompatible: 0, incomplete: 0, invalid: 6 })
    expect(result.metrics.totalMs).toEqual({ count: 2, averageMs: 30, maxMs: 40 })
    expect(result.timelines.map(timeline => timeline.pipeline)).toEqual(['standard', 'stateful'])
    expect(result.slowestSamples.map(sample => sample.totalMs)).toEqual([40, 20])
  }
  finally {
    await fs.remove(root)
  }
})
