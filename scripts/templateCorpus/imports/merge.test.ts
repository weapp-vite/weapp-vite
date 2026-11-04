import type { CorpusLicense, CorpusRepository, CorpusTextFile } from '../types'
import type { NativeEvidenceSource } from './native'
import { describe, expect, it } from 'vitest'
import { corpusHash, corpusJson } from '../integrity'
import { mergeCorpusLicenses, mergeCorpusRepositories, mergeNativeEvidenceSources } from './merge'

function textFile(path: string, text = '{}'): CorpusTextFile {
  return { path, text, sha256: corpusHash(text) }
}

function repository(overrides: Partial<CorpusRepository> = {}): CorpusRepository {
  return {
    repository: 'example/templates',
    commit: 'a'.repeat(40),
    independentRepository: 'example/templates',
    licenseId: 'example-license',
    treeSha256: 'b'.repeat(64),
    treeFiles: 20,
    selectedFiles: 0,
    excludedFiles: 0,
    complete: true,
    ...overrides,
  }
}

function license(overrides: Partial<CorpusLicense> = {}): CorpusLicense {
  return { id: 'example-license', repository: 'example/templates', commit: 'a'.repeat(40), spdx: 'MIT', files: [textFile('LICENSE', 'original grant')], ...overrides }
}

function source(overrides: Partial<NativeEvidenceSource> = {}): NativeEvidenceSource {
  return {
    repository: 'example/templates',
    commit: 'a'.repeat(40),
    tree: [{ path: 'app.json', type: 'blob', sha: 'b'.repeat(40) }],
    configuration: { repository: 'example/templates', commit: 'a'.repeat(40), selections: [], inputProjections: [] },
    ...overrides,
  }
}

describe('collection repository identity merge', () => {
  it('keeps native selection counts, all evidence and incomplete state in either caller order', () => {
    const native = repository({ selectedFiles: 7, excludedFiles: 13, identityEvidence: [textFile('app.json')] })
    const input = repository({ complete: false, identityEvidence: [textFile('project.config.json')], evidence: [{ file: 'sources/ref.json', sha256: 'c'.repeat(64), bytes: 3 }] })
    const before = corpusJson([native, input])
    const forward = mergeCorpusRepositories([native, input])
    expect(mergeCorpusRepositories([input, native])).toEqual(forward)
    expect(forward[0]).toMatchObject({ selectedFiles: 7, excludedFiles: 13, complete: false })
    expect(forward[0]!.identityEvidence?.map(file => file.path)).toEqual(['app.json', 'project.config.json'])
    expect(forward[0]!.evidence).toEqual(input.evidence)
    expect(corpusJson([native, input])).toBe(before)
  })

  it('treats excluded-only views as nonzero and never sums overlapping selections', () => {
    const counted = repository({ selectedFiles: 0, excludedFiles: 20 })
    expect(mergeCorpusRepositories([repository(), counted, counted])[0]).toMatchObject({ selectedFiles: 0, excludedFiles: 20 })
    expect(() => mergeCorpusRepositories([counted, repository({ selectedFiles: 1, excludedFiles: 19 })])).toThrow('Conflicting nonzero repository selection counts')
    expect(() => mergeCorpusRepositories([repository({ selectedFiles: 7, excludedFiles: 13 }), repository({ selectedFiles: 7, excludedFiles: 12 })])).toThrow('Conflicting nonzero repository selection counts')
    expect(() => mergeCorpusRepositories([repository({ selectedFiles: -1 })])).toThrow('Invalid repository file counts')
  })

  it('requires the same frozen tree, license and independent repository identity', () => {
    for (const overrides of [
      { treeSha256: 'c'.repeat(64) },
      { treeFiles: 21 },
      { licenseId: 'other-license' },
      { independentRepository: 'upstream/original' },
    ]) {
      expect(() => mergeCorpusRepositories([repository(), repository(overrides)])).toThrow('Conflicting repository')
    }
    expect(mergeCorpusRepositories([repository({ commit: 'c'.repeat(40) }), repository()])).toHaveLength(2)
  })

  it('deduplicates identical evidence and rejects conflicting path identities', () => {
    const evidence = textFile('app.json')
    const native = repository({ identityEvidence: [evidence, evidence] })
    expect(mergeCorpusRepositories([native, native])[0]!.identityEvidence).toEqual([evidence])
    expect(() => mergeCorpusRepositories([native, repository({ identityEvidence: [textFile('app.json', '{"different":true}')] })])).toThrow('Conflicting repository identity evidence content')
    expect(() => mergeCorpusRepositories([repository({ identityEvidence: [{ ...evidence, text: 'tampered' }] })])).toThrow('content hash mismatch')
    const frozen = { file: 'sources/references.json', sha256: 'a'.repeat(64), bytes: 10 }
    expect(() => mergeCorpusRepositories([repository({ evidence: [frozen] }), repository({ evidence: [{ ...frozen, bytes: 11 }] })])).toThrow('Conflicting repository evidence')
  })
})

describe('collection license identity merge', () => {
  it('deduplicates identical grants independently of file order', () => {
    const first = license({ files: [textFile('NOTICE', 'notice'), textFile('LICENSE', 'grant')] })
    const second = { ...first, files: [...first.files].reverse() }
    expect(mergeCorpusLicenses([first, second])).toEqual(mergeCorpusLicenses([second, first]))
    expect(mergeCorpusLicenses([first, second])[0]!.files.map(file => file.path)).toEqual(['LICENSE', 'NOTICE'])
    expect(first.files[0]!.path).toBe('NOTICE')
  })

  it('rejects reused IDs with different source identity, grants or file inventories', () => {
    for (const overrides of [
      { repository: 'other/templates' },
      { commit: 'b'.repeat(40) },
      { spdx: 'Apache-2.0' },
      { files: [textFile('LICENSE', 'changed grant')] },
      { files: [textFile('LICENSE', 'original grant'), textFile('NOTICE', 'additional')] },
      { files: [{ ...textFile('LICENSE', 'original grant'), text: 'same hash, different body' }] },
    ]) {
      expect(() => mergeCorpusLicenses([license(), license(overrides)])).toThrow('Conflicting license identity or content')
    }
    expect(() => mergeCorpusLicenses([license({ files: [textFile('LICENSE'), textFile('LICENSE')] })])).toThrow('Duplicate license file path')
  })
})

describe('native source evidence merge', () => {
  it('merges matching configurations with distinct containers and extraction declarations', () => {
    const snapshot = textFile('test/output.snap', 'exports["page"] = "<view/>"')
    const first = source({ containers: [textFile('a.ux', '<template><div/></template>')], snapshots: [{ ...snapshot, format: 'jest-files', files: ['a.wxml'] }] })
    const second = source({ containers: [textFile('b.ux', '<template><span/></template>')], snapshots: [{ ...snapshot, format: 'jest-files', files: ['b.axml'] }] })
    const forward = mergeNativeEvidenceSources([first, second, first])
    expect(mergeNativeEvidenceSources([second, first])).toEqual(forward)
    expect(forward[0]!.containers).toHaveLength(2)
    expect(forward[0]!.snapshots).toHaveLength(2)
    expect(first.containers).toHaveLength(1)
  })

  it('rejects different source views before snapshot attachment can select a stale first match', () => {
    const original = source()
    expect(() => mergeNativeEvidenceSources([original, source({ tree: [] })])).toThrow('Conflicting native source tree')
    const inputOnly = source({ configuration: { ...original.configuration as Record<string, unknown>, inputProjections: [{ files: [] }] } })
    expect(() => mergeNativeEvidenceSources([original, inputOnly])).toThrow('pre-merge the complete selections and input projections')
    expect(() => mergeNativeEvidenceSources([inputOnly, original])).toThrow('pre-merge the complete selections and input projections')
    expect(() => mergeNativeEvidenceSources([
      source({ snapshots: [{ ...textFile('output.snap', 'first'), format: 'literal' }] }),
      source({ snapshots: [{ ...textFile('output.snap', 'second'), format: 'jest' }] }),
    ])).toThrow('Conflicting source snapshot content')
  })
})
