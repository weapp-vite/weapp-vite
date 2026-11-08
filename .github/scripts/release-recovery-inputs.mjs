import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export function assertReleaseRecoveryInputs(env) {
  const source = env.REPO_RELEASE_RECOVERY_SOURCE_SHA?.trim() ?? ''
  const acknowledgement = env.REPO_RELEASE_ACKNOWLEDGE_HOOKS?.trim() ?? ''
  const mode = env.REPO_RELEASE_MODE?.trim() || 'auto'

  if (source && (!/^[a-f0-9]{40}$/.test(source) || !['publish', 'publish-unpublished'].includes(mode))) {
    throw new Error('Source recovery requires a full lowercase commit SHA and a publish mode')
  }
  if (acknowledgement && (!source || acknowledgement !== 'release:vscode-marketplace')) {
    throw new Error('Only the verified Marketplace hook can be acknowledged during source recovery')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assertReleaseRecoveryInputs(process.env)
}
