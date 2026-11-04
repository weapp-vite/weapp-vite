import { describe, expect, it } from 'vitest'
import { parseMatrixClassifications } from './matrixClassifications'

const entry = {
  generationId: 'taro-2.2.22-weapp-development',
  path: 'out/development/pages/index/index.wxml',
  sha256: 'a'.repeat(64),
  profileId: 'weapp-legacy',
  expectation: 'invalid',
  diagnosticCodes: ['template/invalid-syntax'],
  evidence: ['upstream/attribute-codegen:unescaped-literal'],
}

describe('frozen matrix classification schema', () => {
  it('keeps explicit independent evidence without changing original input identity', () => {
    const parsed = parseMatrixClassifications({ schemaVersion: 1, entries: [entry] })
    expect(parsed).toEqual([entry])
    expect(parsed[0]).not.toBe(entry)
    parsed[0]!.evidence.push('additional-review')
    expect(entry.evidence).toEqual(['upstream/attribute-codegen:unescaped-literal'])
    expect(parseMatrixClassifications({ schemaVersion: 1, entries: [{ ...entry, expectation: 'pending' }] })[0]!.expectation).toBe('pending')
  })

  it('rejects duplicate output identities even if the replacement changes content or expectation', () => {
    for (const replacement of [entry, { ...entry, sha256: 'b'.repeat(64) }, { ...entry, expectation: 'valid' }]) {
      expect(() => parseMatrixClassifications({ schemaVersion: 1, entries: [entry, replacement] })).toThrow('Duplicate matrix classification')
    }
  })

  it('requires immutable hashes, safe paths, diagnostic codes and independent evidence', () => {
    for (const changes of [
      { generationId: '' },
      { profileId: '' },
      { sha256: 'not-a-hash' },
      { expectation: 'valid-after-parser' },
      { diagnosticCodes: [] },
      { diagnosticCodes: ['same', 'same'] },
      { diagnosticCodes: [''] },
      { evidence: [] },
      { evidence: [' '] },
      { path: '../out/development/page.wxml' },
      { path: 'out/development/../page.wxml' },
      { path: 'out/development/C:page.wxml' },
      { path: 'out\\development\\page.wxml' },
    ]) {
      expect(() => parseMatrixClassifications({ schemaVersion: 1, entries: [{ ...entry, ...changes }] })).toThrow()
    }
    for (const value of [null, {}, { schemaVersion: 2, entries: [] }, { schemaVersion: 1, entries: {} }, { schemaVersion: 1, entries: [null] }]) {
      expect(() => parseMatrixClassifications(value)).toThrow()
    }
  })
})
