import type { CorpusExpectation } from './types'
import assert from 'node:assert/strict'

export const matrixClassificationLabel = 'matrix/classifications.json'

export interface MatrixClassification {
  generationId: string
  path: string
  sha256: string
  profileId: string
  expectation: CorpusExpectation
  diagnosticCodes?: string[]
  evidence: string[]
}

/** 分类独立于候选 parser；完整产物身份与审核依据在冻结前一次确定。 */
export function parseMatrixClassifications(value: unknown): MatrixClassification[] {
  assert.ok(value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1 && 'entries' in value && Array.isArray(value.entries), 'Invalid frozen matrix classifications')
  const seen = new Set<string>()
  return value.entries.map((entry: unknown) => {
    assert.ok(entry && typeof entry === 'object', 'Invalid frozen matrix classification entry')
    const item = entry as MatrixClassification
    assert.ok(typeof item.generationId === 'string' && item.generationId && typeof item.profileId === 'string' && item.profileId, 'Missing matrix classification generation/profile identity')
    assert.ok(typeof item.path === 'string' && item.path.startsWith('out/') && !/[\\:]/.test(item.path)
      && [...item.path].every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
      && item.path.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe matrix classification output path')
    assert.ok(/^[\da-f]{64}$/.test(item.sha256), 'Invalid matrix classification source hash')
    assert.ok(['valid', 'invalid', 'pending'].includes(item.expectation), 'Invalid matrix classification expectation')
    assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0 && item.evidence.every(value => typeof value === 'string' && value.trim()), 'Matrix classification requires independent evidence')
    assert.ok(item.diagnosticCodes === undefined || (Array.isArray(item.diagnosticCodes) && item.diagnosticCodes.every(code => typeof code === 'string' && code.trim()) && new Set(item.diagnosticCodes).size === item.diagnosticCodes.length), 'Invalid matrix classification diagnostic codes')
    assert.ok(item.expectation !== 'invalid' || item.diagnosticCodes?.length, 'Invalid matrix classification needs explicit diagnostic codes')
    const key = `${item.generationId}:${item.path}`
    assert.ok(!seen.has(key), 'Duplicate matrix classification output identity')
    seen.add(key)
    return { ...item, evidence: [...item.evidence], diagnosticCodes: item.diagnosticCodes ? [...item.diagnosticCodes] : undefined }
  })
}
