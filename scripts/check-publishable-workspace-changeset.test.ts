import type { PublishableWorkspacePackageEntry } from './check-publishable-workspace-changeset'
import assert from 'node:assert/strict'
import test from 'vitest'
import {
  collectPublishableWorkspaceChangesetIssues,
  extractChangesetPackages,
  isReleaseWorthyWorkspaceFile,
} from './check-publishable-workspace-changeset'

test('extractChangesetPackages reads package names from frontmatter', () => {
  const packages = extractChangesetPackages([
    '---',
    '"weapp-vite": patch',
    '"@weapp-core/init": patch',
    '---',
    '',
    'summary',
  ].join('\n'))

  assert.deepEqual(packages, ['weapp-vite', '@weapp-core/init'])
})

test('isReleaseWorthyWorkspaceFile ignores test and docs noise', () => {
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/src/index.ts', 'packages/demo'), true)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/bin/cli.js', 'packages/demo'), true)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/test/index.test.ts', 'packages/demo'), false)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/README.md', 'packages/demo'), false)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/vitest.config.ts', 'packages/demo'), false)
})

test('collectPublishableWorkspaceChangesetIssues reports missing changed packages and releasing dependents', () => {
  const packages: PublishableWorkspacePackageEntry[] = [
    {
      dir: '@weapp-core/init',
      name: '@weapp-core/init',
      localWorkspaceDependencies: [],
    },
    {
      dir: 'packages/weapp-vite',
      name: 'weapp-vite',
      localWorkspaceDependencies: ['@weapp-core/init'],
    },
  ]

  const issues = collectPublishableWorkspaceChangesetIssues({
    packages,
    changedFiles: ['@weapp-core/init/src/index.ts', 'packages/weapp-vite/README.md'],
    changesetPackages: new Set(['weapp-vite']),
  })

  assert.equal(issues.length, 2)
  assert.match(issues[0]!, /Missing changeset/)
  assert.match(issues[0]!, /@weapp-core\/init/)
  assert.match(issues[1]!, /weapp-vite -> @weapp-core\/init/)
})

test('collectPublishableWorkspaceChangesetIssues accepts complete release sets', () => {
  const packages: PublishableWorkspacePackageEntry[] = [
    {
      dir: '@weapp-core/init',
      name: '@weapp-core/init',
      localWorkspaceDependencies: [],
    },
    {
      dir: 'packages/weapp-vite',
      name: 'weapp-vite',
      localWorkspaceDependencies: ['@weapp-core/init'],
    },
  ]

  const issues = collectPublishableWorkspaceChangesetIssues({
    packages,
    changedFiles: ['@weapp-core/init/src/index.ts', 'packages/weapp-vite/src/index.ts'],
    changesetPackages: new Set(['weapp-vite', '@weapp-core/init']),
  })

  assert.deepEqual(issues, [])
})
