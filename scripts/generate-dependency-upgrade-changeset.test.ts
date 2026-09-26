import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'
import {
  collectDependencySpecChanges,
  collectPublishableReleasePackageNames,
  formatDependencyUpgradeBody,
  resolveDependencyUpgradeReleasePackages,
  shouldWriteDependencyUpgradeChangeset,
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

it('collectPublishableReleasePackageNames includes every publishable package', () => {
  assert.deepEqual(
    collectPublishableReleasePackageNames([
      { name: 'wevu' },
      { name: 'weapp-vite' },
      { name: 'wevu' },
    ]),
    ['weapp-vite', 'wevu'],
  )
})

it('shouldWriteDependencyUpgradeChangeset only writes when this run has upgrades', () => {
  assert.equal(
    shouldWriteDependencyUpgradeChangeset({
      changedPublishablePackages: [],
      templatePackageChanged: false,
    }),
    false,
  )
  assert.equal(
    shouldWriteDependencyUpgradeChangeset({
      changedPublishablePackages: ['@weapp-vite/eslint'],
      templatePackageChanged: false,
    }),
    true,
  )
  assert.equal(
    shouldWriteDependencyUpgradeChangeset({
      changedPublishablePackages: [],
      templatePackageChanged: true,
    }),
    true,
  )
})

it('formatDependencyUpgradeBody keeps this-run summaries in Chinese', () => {
  assert.equal(
    formatDependencyUpgradeBody([
      { name: '@weapp-vite/eslint', summary: 'devDependencies.vitest' },
    ]),
    `自动补充依赖升级发布记录。
涉及包：
- @weapp-vite/eslint：devDependencies.vitest
`,
  )
})

it('dependency upgrade generator does not overwrite or delete a fixed changeset path', async () => {
  const source = await fs.readFile(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'generate-dependency-upgrade-changeset.ts'),
    'utf8',
  )

  assert.equal(source.includes('dependency-upgrade-auto-generated.md'), false)
  assert.equal(source.includes('fs.rm'), false)
  assert.match(source, /writeUniqueChangeset/)
  assert.match(source, /collectPublishableReleasePackageNames/)
})
