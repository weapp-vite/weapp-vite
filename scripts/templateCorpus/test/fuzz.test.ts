import { describe, expect, it } from 'vitest'
import * as api from '../../../packages/wxml/src/index'
import { defaultFuzzSeed, formalFuzzBudget, generateValidCase, minimizeFailure, runFuzz } from '../fuzz'
import { corpusProfiles } from '../profiles'

describe('deterministic template combinations', () => {
  it('freezes formal budgets and independently generated structures', () => {
    expect(formalFuzzBudget).toEqual({ valid: 100_000, invalid: 100_000, editSequences: 10_000, editSteps: 8 })
    expect(generateValidCase(defaultFuzzSeed, 42, corpusProfiles[0]!)).toEqual(generateValidCase(defaultFuzzSeed, 42, corpusProfiles[0]!))
    const profileCount = corpusProfiles.length
    const report = runFuzz(api, corpusProfiles, { valid: profileCount * 4, invalid: profileCount * 8, editSequences: profileCount })
    expect(report.failures).toEqual([])
    expect(report.completed).toEqual({ valid: profileCount * 4, invalid: profileCount * 8, editSequences: profileCount, editSteps: profileCount * 8 })
    expect(report.formal).toBe(false)
    expect(report.accepted).toBe(false)
    for (const profile of corpusProfiles) {
      expect(report.scenarios[profile.id]?.['eight-step-edit']).toBe(1)
      expect(report.scenarios[profile.id]?.['mismatched-close']).toBe(1)
      expect(report.scenarios[profile.id]?.['unterminated-comment']).toBe(1)
    }
  })

  it('keeps the original, seed, stage and reduced counterexample on failure', () => {
    const report = runFuzz({ ...api, serialize: () => '' }, [corpusProfiles[0]!], { valid: 1, invalid: 0, editSequences: 0 })
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0]).toMatchObject({ seed: defaultFuzzSeed, index: 0, stage: 'preserve', kind: 'valid' })
    expect(report.failures[0]!.minimized.source.length).toBeLessThanOrEqual(report.failures[0]!.source.length)
  })

  it('only shrinks while the caller supplied failure predicate remains true', () => {
    const shrunk = minimizeFailure('before BUG after', candidate => candidate.includes('BUG'))
    expect(shrunk.source).toBe('BUG')
    expect(shrunk.checks).toBeGreaterThan(0)
    expect(() => runFuzz(api, [], { valid: 0 })).toThrow('profile')
    expect(() => runFuzz(api, corpusProfiles, { valid: -1 })).toThrow('budgets')
  })
})
