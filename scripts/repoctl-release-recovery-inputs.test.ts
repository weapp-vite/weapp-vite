import { expect, it } from 'vitest'
import { assertReleaseRecoveryInputs } from '../.github/scripts/release-recovery-inputs.mjs'

const source = 'a'.repeat(40)
const acknowledgement = 'release:vscode-marketplace'

it.each(['auto', 'prepare', 'reconcile'])('rejects a source recovery in %s mode before running release stages', (mode) => {
  expect(() => assertReleaseRecoveryInputs({
    REPO_RELEASE_MODE: mode,
    REPO_RELEASE_RECOVERY_SOURCE_SHA: source,
  })).toThrow(/publish mode/)
})

it.each(['short', 'A'.repeat(40), '../source'])('rejects invalid recovery source %s', (value) => {
  expect(() => assertReleaseRecoveryInputs({
    REPO_RELEASE_MODE: 'publish',
    REPO_RELEASE_RECOVERY_SOURCE_SHA: value,
  })).toThrow(/full lowercase commit SHA/)
})

it.each(['publish', 'publish-unpublished'])('accepts a verified Marketplace acknowledgement only in source recovery %s', (mode) => {
  expect(() => assertReleaseRecoveryInputs({
    REPO_RELEASE_MODE: mode,
    REPO_RELEASE_RECOVERY_SOURCE_SHA: source,
    REPO_RELEASE_ACKNOWLEDGE_HOOKS: acknowledgement,
  })).not.toThrow()
})

it('rejects acknowledgements without a source or for other hooks', () => {
  for (const env of [
    { REPO_RELEASE_MODE: 'publish', REPO_RELEASE_ACKNOWLEDGE_HOOKS: acknowledgement },
    { REPO_RELEASE_MODE: 'publish', REPO_RELEASE_RECOVERY_SOURCE_SHA: source, REPO_RELEASE_ACKNOWLEDGE_HOOKS: 'quality' },
    { REPO_RELEASE_MODE: 'publish', REPO_RELEASE_RECOVERY_SOURCE_SHA: source, REPO_RELEASE_ACKNOWLEDGE_HOOKS: `${acknowledgement},release:sync-npmmirror` },
  ]) {
    expect(() => assertReleaseRecoveryInputs(env)).toThrow(/Only the verified Marketplace hook/)
  }
})

it('preserves normal releases and source recovery without an acknowledgement', () => {
  expect(() => assertReleaseRecoveryInputs({ REPO_RELEASE_MODE: 'auto' })).not.toThrow()
  expect(() => assertReleaseRecoveryInputs({ REPO_RELEASE_MODE: 'publish', REPO_RELEASE_RECOVERY_SOURCE_SHA: source })).not.toThrow()
})
