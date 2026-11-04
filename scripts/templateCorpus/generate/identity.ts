import type { GenerationIdentity } from './types'
import assert from 'node:assert/strict'

export function validateGenerationIdentity(identity: GenerationIdentity): void {
  assert.ok(/^[\w.-]+\/[\w.-]+$/.test(identity.repository), 'Invalid generation source repository')
  assert.ok(/^[\da-f]{40}$/.test(identity.commit), 'Generation source must use an immutable commit')
  assert.ok(identity.licenseId && identity.licenseId !== 'NOASSERTION', 'Generation input must have a confirmed license')
}
