import type { PublishableWorkspacePackageEntry } from './check-publishable-workspace-changeset'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundleRequire } from 'bundle-require'
import { it } from 'vitest'
import {
  collectChangesetPackages as collectChangesetPackagesFromUtils,
  extractChangesetPackages,
  hasNonReleaseArtifactTemplateChange,
  hasReleaseArtifactsForPackage,
} from './changeset-utils'
import {
  collectConstantsDependentReleaseIssues,
  collectPublishableWorkspaceChangesetIssues,
  isCurrentModuleEntry,
  isReleaseWorthyWorkspaceFile,
} from './check-publishable-workspace-changeset'
import { collectWorkspaceProtocolViolations } from './check-publishable-workspace-dependency-protocols'
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

it('collectPublishableWorkspaceChangesetIssues requires constants dependents when constants releases', () => {
  const packages: PublishableWorkspacePackageEntry[] = [
    {
      dir: '@weapp-core/constants',
      name: '@weapp-core/constants',
      localWorkspaceDependencies: [],
    },
    {
      dir: 'packages-runtime/wevu',
      name: 'wevu',
      localWorkspaceDependencies: ['@weapp-core/constants'],
    },
    {
      dir: 'packages/weapp-vite',
      name: 'weapp-vite',
      localWorkspaceDependencies: ['@weapp-core/constants', 'wevu'],
    },
  ]

  const issues = collectPublishableWorkspaceChangesetIssues({
    packages,
    changedFiles: ['@weapp-core/constants/src/index.ts'],
    changesetPackages: new Set(['@weapp-core/constants']),
  })

  assert.equal(issues.length, 1)
  assert.match(issues[0]!, /public direct dependents/)
  assert.match(issues[0]!, /weapp-vite/)
  assert.match(issues[0]!, /wevu/)
})

it('collectConstantsDependentReleaseIssues accepts complete constants release sets', () => {
  const issues = collectConstantsDependentReleaseIssues({
    packages: [
      {
        dir: '@weapp-core/constants',
        name: '@weapp-core/constants',
        localWorkspaceDependencies: [],
      },
      {
        dir: 'packages-runtime/wevu',
        name: 'wevu',
        localWorkspaceDependencies: ['@weapp-core/constants'],
      },
    ],
    changesetPackages: new Set(['@weapp-core/constants', 'wevu']),
  })

  assert.deepEqual(issues, [])
})

it('repoctl release lifecycle keeps PR-only intent guards outside main push checks', async () => {
  const configPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../repoctl.config.ts',
  )
  const { mod } = await bundleRequire<{
    default: {
      commands: {
        release: {
          hooks: Record<string, string[]>
          qualityScripts: string[]
        }
      }
    }
  }>({ filepath: configPath })
  const config = mod.default
  const releaseConfig = config.commands.release

  assert.deepEqual(releaseConfig.qualityScripts, [
    'check:changeset:frontmatter',
    'check:publishable-workspace-dependency-protocols',
    'check:weapp-core-constants-dependency-range',
    'check:rolldown:single-version',
    'lint',
    'ci:release',
    'test:packages',
    'test:types',
  ])
  assert.equal(releaseConfig.qualityScripts.includes('check:publishable-workspace-changeset'), false)
  assert.equal(releaseConfig.qualityScripts.includes('check:weapp-core-constants-changeset'), false)
  assert.deepEqual(releaseConfig.hooks, {
    beforeVersion: ['catalog:sync:create-weapp-vite'],
    afterVersion: ['check:weapp-core-constants-release-version'],
    beforePublish: ['check:weapp-core-constants-release-version'],
    afterPublish: ['release:vscode-marketplace'],
  })
})

it('ci:release keeps release build concurrency bounded', async () => {
  const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../package.json',
  )
  const content = await fs.readFile(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(content) as {
    scripts?: Record<string, string>
  }

  const releaseBuildScript = packageJson.scripts?.['ci:release'] ?? ''

  assert.match(releaseBuildScript, /turbo run --concurrency=2\b/)
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

it('collectWorkspaceProtocolViolations requires exact workspace protocol for publishable packages', () => {
  const workspacePackageNames = new Set(['@weapp-core/constants', 'wevu'])

  assert.deepEqual(
    collectWorkspaceProtocolViolations({
      file: 'packages-runtime/wevu/package.json',
      packageJson: {
        name: 'wevu',
        dependencies: {
          '@weapp-core/constants': 'workspace:*',
        },
      },
      workspacePackageNames,
    }),
    [],
  )

  const violations = collectWorkspaceProtocolViolations({
    file: 'packages-runtime/wevu/package.json',
    packageJson: {
      name: 'wevu',
      dependencies: {
        '@weapp-core/constants': 'workspace:^',
      },
    },
    workspacePackageNames,
  })

  assert.equal(violations.length, 1)
  assert.match(violations[0]!, /workspace:\^/)
})

it('collectWorkspaceProtocolViolations ignores private package manifests', () => {
  const violations = collectWorkspaceProtocolViolations({
    file: 'apps/demo/package.json',
    packageJson: {
      name: 'demo',
      private: true,
      dependencies: {
        wevu: 'workspace:^',
      },
    },
    workspacePackageNames: new Set(['wevu']),
  })

  assert.deepEqual(violations, [])
})
