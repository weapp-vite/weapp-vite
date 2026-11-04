import type { CorpusFileIdentity } from '../types'
import assert from 'node:assert/strict'
import { assertIdentity } from './files'

export const attributionNoticesLabel = 'attribution/notices.json'

export interface AttributionNotice {
  repository: string
  commit: string
  licenseId: string
  path: string
  gitSha: string
  object: CorpusFileIdentity
  purpose: 'attribution-only'
  grantReview: 'does-not-change-license-grant'
  rationale: string
  scope: { kind: 'repository' } | { kind: 'directory', path: string }
  appliesTo: Array<{ kind: 'template' | 'input' | 'identity-evidence', path: string }>
}

/** 上游路径允许仓库自带的 node_modules；正文读取仍须由普通受控文件完成。 */
export function attributionSourcePath(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value) && !value.startsWith('/') && !/[\\:]/.test(value)
    && [...value].every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    && value.split('/').every(part => part && part !== '.' && part !== '..')
}

/** 补充声明只保存归属义务，不参与许可推断或覆盖既有 grant。 */
export function parseAttributionNotices(value: unknown): AttributionNotice[] {
  assert.ok(value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1 && 'entries' in value && Array.isArray(value.entries) && value.entries.length, 'Invalid attribution notice supplement')
  const entries = value.entries as AttributionNotice[]
  const keys = new Set<string>()
  for (const entry of entries) {
    assert.ok(entry && typeof entry === 'object' && typeof entry.repository === 'string' && /^[\w.-]+\/[\w.-]+$/.test(entry.repository) && entry.repository.split('/').every(part => part !== '.' && part !== '..'), 'Invalid attribution notice repository')
    assert.ok(typeof entry.commit === 'string' && /^[\da-f]{40}$/.test(entry.commit) && typeof entry.gitSha === 'string' && /^[\da-f]{40}$/.test(entry.gitSha), 'Invalid attribution notice Git identity')
    assert.ok(typeof entry.licenseId === 'string' && entry.licenseId.trim() && attributionSourcePath(entry.path), 'Invalid attribution notice source/license')
    assertIdentity(entry.object)
    assert.equal(entry.object.file, `objects/${entry.object.sha256}`, 'Attribution notice body must use its CAS identity')
    assert.ok(entry.purpose === 'attribution-only' && entry.grantReview === 'does-not-change-license-grant' && typeof entry.rationale === 'string' && entry.rationale.trim(), 'Attribution supplement cannot replace a license grant')
    const parent = entry.path.split('/').slice(0, -1).join('/')
    assert.ok(entry.scope && (parent ? entry.scope.kind === 'directory' && 'path' in entry.scope && entry.scope.path === parent : entry.scope.kind === 'repository'), 'Attribution notice scope must match its source directory')
    assert.ok(Array.isArray(entry.appliesTo) && entry.appliesTo.length, 'Attribution notice needs an actual distributed relationship')
    const relations = new Set<string>()
    for (const relation of entry.appliesTo) {
      assert.ok(relation && ['template', 'input', 'identity-evidence'].includes(relation.kind) && attributionSourcePath(relation.path), 'Invalid attribution notice relationship')
      assert.ok(!parent || relation.path.startsWith(`${parent}/`), 'Attribution notice relationship falls outside its source scope')
      const key = `${relation.kind}:${relation.path}`
      assert.ok(!relations.has(key), 'Duplicate attribution notice relationship')
      relations.add(key)
    }
    const key = `${entry.repository}@${entry.commit}:${entry.path.normalize('NFC').toLocaleLowerCase('en')}`
    assert.ok(!keys.has(key), 'Duplicate attribution notice source')
    keys.add(key)
  }
  return entries
}
