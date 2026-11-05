import type { CorpusDocument, CorpusManifest } from '../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { profileFixtures, profileGroups } from './fixtures'
import { assertRegressionExpectations } from './regressionInputs'

const origin = { repository: 'fixture/repo', commit: '0123456789012345678901234567890123456789', path: 'page.wxml', platform: 'weapp', profileId: 'weapp-legacy', category: 'native' as const, licenseId: 'fixture', expectation: 'valid' as const }
const profile = { id: 'weapp-legacy', platform: 'weapp', parserPlatform: 'weapp' as const, syntax: 'legacy' as const, rawTags: [], resolver: 'none' as const }

function fixture(source: string): CorpusDocument {
  return { sha256: 'a'.repeat(64), source, origins: [origin] }
}

describe('template regression policy', () => {
  it('blocks unresolved input expectations instead of accepting a reduced denominator', () => {
    expect(() => assertRegressionExpectations([{ expectation: 'invalid' }])).not.toThrow()
    expect(() => assertRegressionExpectations([{ expectation: 'pending' }])).toThrow('Pending corpus expectations')
  })

  it('keeps the frozen-main identity and formal sampling contract explicit', async () => {
    const policy = JSON.parse(await readFile(path.join(process.cwd(), 'scripts/templateCorpus/benchmark/regression-policy.json'), 'utf8')) as { baselineRef: string, baselineLockSha256: string, sampling: { rounds: number, warmup: number }, thresholds: { aggregateMaximumRatio: number, categoryMaximumRatio: number } }
    expect(policy.baselineRef).toBe('739da6b848a47ac44cb567ce643b97ff79da9cc4')
    expect(policy.baselineLockSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(policy.sampling).toEqual(expect.objectContaining({ rounds: 40, warmup: 10 }))
    expect(policy.thresholds.aggregateMaximumRatio).toBe(1.03)
    expect(policy.thresholds.categoryMaximumRatio).toBe(1.05)
  })

  it('marks every valid platform group comparable for baseline regression', () => {
    const document = fixture('<view wx:if="{{ok}}" />')
    const manifest = { profiles: [profile], generations: [], repositories: [], licenses: [] } as unknown as CorpusManifest
    const { fixtures } = profileFixtures([document], manifest)
    const groups = profileGroups(fixtures, true)
    expect(groups.length).toBeGreaterThan(0)
    expect(groups.every(group => group.comparable)).toBe(true)
  })
})
