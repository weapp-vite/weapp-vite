import type { PublishableWorkspacePackageEntry } from './check-publishable-workspace-changeset'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { it } from 'vitest'
import {
  collectChangesetPackages as collectChangesetPackagesFromUtils,
  extractChangesetPackages,
  hasNonReleaseArtifactTemplateChange,
  hasReleaseArtifactsForPackage,
} from './changeset-utils'
import {
  collectPublishableWorkspaceChangesetIssues,
  isCurrentModuleEntry,
  isReleaseWorthyWorkspaceFile,
} from './check-publishable-workspace-changeset'
import { collectConstantsReleaseVersionIssues } from './check-weapp-core-constants-release-version'

it('extractChangesetPackages reads package names from frontmatter', () => {
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

it('collectChangesetPackages ignores deleted changeset files', async () => {
  const existingFile = path.resolve(process.cwd(), '.changeset/__codex-existing-changeset__.md')
  await fs.writeFile(existingFile, [
    '---',
    '"weapp-vite": patch',
    '---',
    '',
    'summary',
  ].join('\n'))

  try {
    const packages = await collectChangesetPackagesFromUtils([
      existingFile,
      path.resolve(process.cwd(), '.changeset/__codex-missing-changeset__.md'),
    ])

    assert.deepEqual([...packages], ['weapp-vite'])
  }
  finally {
    await fs.rm(existingFile, { force: true })
  }
})

it('hasReleaseArtifactsForPackage detects release-generated package files', () => {
  assert.equal(
    hasReleaseArtifactsForPackage([
      'packages/create-weapp-vite/package.json',
      'templates/weapp-vite-lib-template/package.json',
    ], 'packages/create-weapp-vite'),
    true,
  )
  assert.equal(
    hasReleaseArtifactsForPackage([
      'templates/weapp-vite-lib-template/package.json',
    ], 'packages/create-weapp-vite'),
    false,
  )
})

it('hasNonReleaseArtifactTemplateChange ignores release-only template artifacts', () => {
  assert.equal(
    hasNonReleaseArtifactTemplateChange([
      'templates/weapp-vite-lib-template/package.json',
      'templates/weapp-vite-lib-template/CHANGELOG.md',
    ]),
    false,
  )
  assert.equal(
    hasNonReleaseArtifactTemplateChange([
      'templates/weapp-vite-lib-template/src/index.ts',
    ]),
    true,
  )
})

it('isCurrentModuleEntry resolves relative argv paths without throwing', () => {
  const entryArg = path.relative(process.cwd(), path.resolve(process.cwd(), 'scripts/check-publishable-workspace-changeset.ts'))
  const moduleUrl = pathToFileURL(path.resolve(process.cwd(), entryArg)).href

  assert.equal(isCurrentModuleEntry(entryArg, moduleUrl), true)
  assert.equal(isCurrentModuleEntry('scripts/other-script.ts', moduleUrl), false)
  assert.equal(isCurrentModuleEntry(undefined, moduleUrl), false)
})

it('isReleaseWorthyWorkspaceFile ignores test and docs noise', () => {
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/src/index.ts', 'packages/demo'), true)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/bin/cli.js', 'packages/demo'), true)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/test/index.test.ts', 'packages/demo'), false)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/README.md', 'packages/demo'), false)
  assert.equal(isReleaseWorthyWorkspaceFile('packages/demo/vitest.config.ts', 'packages/demo'), false)
})

it('collectPublishableWorkspaceChangesetIssues reports missing changed packages and releasing dependents', () => {
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

it('collectPublishableWorkspaceChangesetIssues accepts complete release sets', () => {
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

it('publish-packages runs constants guards before publishing packages', async () => {
  const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../package.json',
  )
  const content = await fs.readFile(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(content) as {
    scripts?: Record<string, string>
  }

  const publishScript = packageJson.scripts?.['publish-packages'] ?? ''
  const changesetGuardIndex = publishScript.indexOf('check:weapp-core-constants-changeset')
  const versionIndex = publishScript.indexOf('changeset version')
  const versionGuardIndex = publishScript.indexOf('check:weapp-core-constants-release-version')
  const publishIndex = publishScript.indexOf('changeset publish')

  assert.notEqual(changesetGuardIndex, -1)
  assert.notEqual(versionIndex, -1)
  assert.notEqual(versionGuardIndex, -1)
  assert.notEqual(publishIndex, -1)
  assert.equal(changesetGuardIndex < versionIndex, true)
  assert.equal(versionIndex < versionGuardIndex, true)
  assert.equal(versionGuardIndex < publishIndex, true)
})

it('collectConstantsReleaseVersionIssues reports unchanged versions with changed constants sources', () => {
  const issues = collectConstantsReleaseVersionIssues({
    changedFiles: ['@weapp-core/constants/src/index.ts'],
    packageName: '@weapp-core/constants',
    tagExists: true,
    version: '0.1.7',
  })

  assert.equal(issues.length, 1)
  assert.match(issues[0]!, /@weapp-core\/constants is still at 0\.1\.7/)
})

it('collectConstantsReleaseVersionIssues accepts constants versions without an existing tag', () => {
  const issues = collectConstantsReleaseVersionIssues({
    changedFiles: ['@weapp-core/constants/src/index.ts'],
    packageName: '@weapp-core/constants',
    tagExists: false,
    version: '0.1.8',
  })

  assert.deepEqual(issues, [])
})
