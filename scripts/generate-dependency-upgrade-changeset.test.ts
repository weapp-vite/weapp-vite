import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  collectDependencySpecChanges,
  resolveDependencyUpgradeReleasePackages,
} from './generate-dependency-upgrade-changeset'

it('collectDependencySpecChanges detects changed, added and removed dependency specs', () => {
  const changes = collectDependencySpecChanges(
    {
      dependencies: {
        vite: '^7.0.0',
        vue: '^3.5.0',
      },
      devDependencies: {
        eslint: '^9.0.0',
      },
    },
    {
      dependencies: {
        vite: '^8.0.0',
        rolldown: '^1.0.0',
      },
      devDependencies: {
        eslint: '^9.0.0',
      },
    },
  )

  assert.deepEqual(changes, [
    { section: 'dependencies', name: 'rolldown', before: null, after: '^1.0.0' },
    { section: 'dependencies', name: 'vite', before: '^7.0.0', after: '^8.0.0' },
    { section: 'dependencies', name: 'vue', before: '^3.5.0', after: null },
  ])
})

it('collectDependencySpecChanges ignores non-dependency package.json edits', () => {
  const changes = collectDependencySpecChanges(
    {
      dependencies: {
        vite: '^8.0.0',
      },
    },
    {
      dependencies: {
        vite: '^8.0.0',
      },
    },
  )

  assert.deepEqual(changes, [])
})

it('resolveDependencyUpgradeReleasePackages adds create-weapp-vite for weapp-vite and template upgrades', () => {
  assert.deepEqual(
    resolveDependencyUpgradeReleasePackages({
      changedPublishablePackages: ['weapp-vite'],
      templatePackageChanged: false,
    }),
    ['create-weapp-vite', 'weapp-vite'],
  )

  assert.deepEqual(
    resolveDependencyUpgradeReleasePackages({
      changedPublishablePackages: ['@weapp-vite/vscode'],
      templatePackageChanged: true,
    }),
    ['@weapp-vite/vscode', 'create-weapp-vite'],
  )
})
