import type { MatrixClassification } from '../matrixClassifications'
import { expect, it } from 'vitest'
import { matrixClassificationLabel } from '../matrixClassifications'
import { CorpusEvidenceStore, mergeFrozenResources } from './files'
import { nativeMetadata } from './testFixtures'
import { validateFrozenReferences } from './verify'

function fixture(entries: MatrixClassification[] = []) {
  const native = nativeMetadata()
  const store = new CorpusEvidenceStore()
  const original = `${JSON.stringify({ schemaVersion: 1, entries }, null, 2).replaceAll('\n', '\r\n')}\r\n`
  const identity = store.object(original)
  const index = store.json('additional/references.json', 'report', {
    schemaVersion: 1,
    kind: 'additional',
    files: [{ file: matrixClassificationLabel, kind: 'report', object: identity }],
  })
  const metadata = { ...native.metadata, additionalEvidence: [index], matrixClassifications: identity }
  const resources = mergeFrozenResources([...native.resources, ...store.resources()])
  return { metadata, identity, resources }
}

it('binds the manifest classification to the exact original bytes under the fixed additional label', () => {
  const value = fixture()
  expect(() => validateFrozenReferences(value.metadata, [], value.resources)).not.toThrow()
  expect(() => validateFrozenReferences({ ...value.metadata, matrixClassifications: undefined }, [], value.resources)).toThrow('both a manifest binding and the fixed additional evidence label')
  expect(() => validateFrozenReferences({ ...value.metadata, additionalEvidence: undefined }, [], value.resources)).toThrow('both a manifest binding and the fixed additional evidence label')
  expect(() => validateFrozenReferences({ ...value.metadata, matrixClassifications: { ...value.identity, sha256: 'f'.repeat(64) } }, [], value.resources)).toThrow('differs from its additional evidence object')
  expect(() => validateFrozenReferences(value.metadata, [], value.resources.filter(resource => resource.file !== value.identity.file))).toThrow('Missing frozen evidence resource')
})

it('rejects malformed or orphan classifications before archive acceptance', () => {
  const value = fixture([{
    generationId: 'missing-generation',
    path: 'out/production/base.wxml',
    sha256: 'a'.repeat(64),
    profileId: 'weapp-legacy',
    expectation: 'invalid',
    diagnosticCodes: ['template/invalid-syntax'],
    evidence: ['upstream-codegen-reviewed'],
  }])
  expect(() => validateFrozenReferences(value.metadata, [], value.resources)).toThrow('Orphan matrix classification')
  const malformed = fixture([{
    generationId: 'missing-generation',
    path: 'out/production/base.wxml',
    sha256: 'a'.repeat(64),
    profileId: 'weapp-legacy',
    expectation: 'invalid',
    evidence: [],
  }])
  expect(() => validateFrozenReferences(malformed.metadata, [], malformed.resources)).toThrow('requires independent evidence')
})
