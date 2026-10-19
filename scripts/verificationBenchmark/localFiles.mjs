import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createAcceptanceIdentity } from '../../e2e/scripts/domAcceptanceReport/helpers.ts'
import { evidenceDigest } from './evidence.mjs'

export { localDocument, localRelative, localSave } from './localIo.mjs'

export function localIdentity(root, runId) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
  const identity = createAcceptanceIdentity({ WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID: runId }, git)
  assert(identity.workingTreeDirty === false && /^[a-f\d]{40,64}$/u.test(identity.commitSha), 'Local benchmark requires a clean frozen checkout')
  return { ...identity, fingerprint: evidenceDigest([identity.commitSha, git(['rev-parse', 'HEAD^{tree}']).trim()]) }
}
