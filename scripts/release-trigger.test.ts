import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  hasReleaseArtifactPair,
  isReleaseCommitMessage,
  shouldRunRelease,
} from './release-trigger'

const baseContext = {
  eventName: 'push',
  branch: 'main',
  pendingChangesetFiles: [],
  changedFiles: ['packages/weapp-vite/src/index.ts'],
  commitMessage: 'feat(weapp-vite): update compiler',
} as const

describe('release trigger', () => {
  it('skips an ordinary main source push', () => {
    assert.equal(shouldRunRelease(baseContext), false)
  })

  it('runs when a pending changeset exists', () => {
    assert.equal(shouldRunRelease({
      ...baseContext,
      pendingChangesetFiles: ['.changeset/quiet-wevu-test-utils.md'],
    }), true)
  })

  it('runs for release commit subjects on main', () => {
    assert.equal(shouldRunRelease({
      ...baseContext,
      commitMessage: 'chore(release): 更新包版本 (#816)',
    }), true)
    assert.equal(shouldRunRelease({
      ...baseContext,
      commitMessage: 'Version Packages (#812)',
    }), true)
  })

  it('runs when a package has both release artifacts changed', () => {
    assert.equal(hasReleaseArtifactPair([
      'packages/weapp-vite/package.json',
      'packages/weapp-vite/CHANGELOG.md',
    ]), true)
    assert.equal(shouldRunRelease({
      ...baseContext,
      changedFiles: [
        'packages/weapp-vite/package.json',
        'packages/weapp-vite/CHANGELOG.md',
      ],
    }), true)
  })

  it('skips ordinary prerelease pushes and runs prerelease pushes with intent', () => {
    for (const branch of ['alpha', 'beta', 'rc', 'next']) {
      assert.equal(shouldRunRelease({ ...baseContext, branch }), false)
      assert.equal(shouldRunRelease({
        ...baseContext,
        branch,
        pendingChangesetFiles: ['.changeset/release.md'],
      }), true)
    }
  })

  it('always runs workflow dispatch for every release mode', () => {
    for (const mode of ['auto', 'prepare', 'publish', 'publish-unpublished']) {
      assert.equal(shouldRunRelease({
        ...baseContext,
        eventName: 'workflow_dispatch',
        commitMessage: mode,
      }), true)
    }
  })

  it('recognizes only release commit subjects', () => {
    assert.equal(isReleaseCommitMessage('chore(release): version packages'), true)
    assert.equal(isReleaseCommitMessage('feat: Version Packages'), false)
  })
})
