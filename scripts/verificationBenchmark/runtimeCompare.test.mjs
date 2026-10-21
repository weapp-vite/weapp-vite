import { expect, it } from 'vitest'
import { compareSamples, validateSample } from './compare.mjs'

function samples() {
  return ['baseline', 'candidate'].flatMap(variant => Array.from({ length: 3 }, (_, index) => ({
    schemaVersion: 1,
    id: `${variant}-${index}`,
    variant,
    revision: variant,
    sourceFingerprint: (variant === 'baseline' ? 'a' : 'b').repeat(64),
    inputDigest: 'c'.repeat(64),
    scopeDigest: 'd'.repeat(64),
    outcome: 'passed',
    complete: true,
    profile: { os: 'darwin', node: 'v24.18.0', provider: 'devtools', platform: 'weapp', runnerClass: 'local', cachePolicy: 'warm', arch: 'arm64', packageManager: 'pnpm@12.11.2', ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.4' },
    metrics: { executionMs: variant === 'baseline' ? 100 : 60, approvalWaitMs: 0, schedulingWaitMs: 0, runnerMs: variant === 'baseline' ? 100 : 60 },
  })))
}

it.each(['arch', 'packageManager', 'ideVersion', 'baseLibraryVersion'])('compares actual optional %s identity and rejects missing identity in only one sample', (key) => {
  const values = samples()
  expect(compareSamples(values).meetsTarget).toBe(true)
  values[5].profile[key] = 'different'
  expect(() => compareSamples(values)).toThrow(/profile differ/)
  delete values[5].profile[key]
  expect(() => compareSamples(values)).toThrow(/profile differ/)
})

it('keeps older samples comparable only when every sample omits the same optional identity', () => {
  const values = samples().map(value => ({ ...value, profile: { os: 'linux', node: 'v24.18.0', provider: 'none', platform: 'workspace', runnerClass: 'local', cachePolicy: 'warm' } }))
  expect(compareSamples(values).meetsTarget).toBe(true)
})

it.each(['arch', 'packageManager', 'ideVersion', 'baseLibraryVersion'])('rejects an invalid provided %s rather than dropping it', (key) => {
  for (const value of ['', ' ', null, undefined, 42]) {
    const sample = samples()[0]
    sample.profile[key] = value
    expect(() => validateSample(sample)).toThrow(/optional benchmark profile/)
  }
})
