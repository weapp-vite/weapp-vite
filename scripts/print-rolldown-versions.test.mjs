import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

import {
  collectRolldownExpectedPublishedSpecs,
  collectRolldownPublishArtifactIssues,
  collectViteRolldownVersions,
  formatRolldownVersionReport,
  formatRolldownWarningReport,
  packWorkspacePackageJson,
  readPackedPackageJsonFromTarball,
  resolveAnsiEnabled,
  resolveCatalogDependencyVersion,
  resolveDependencySpecVersion,
  resolveMode,
  resolveWorkspacePackageSpecVersion,
  syncRolldownCatalogReferences,
  verifyRolldownCatalogReferences,
  verifySingleRolldownVersion,
} from './print-rolldown-versions.mjs'

it('formatRolldownVersionReport appends a compact summary after detailed sections', () => {
  const report = formatRolldownVersionReport('/workspace', new Map([
    ['1.0.0-rc.10', new Set(['packages/weapp-vite'])],
    ['1.0.0-rc.9', new Set(['packages/rolldown-require'])],
  ]))

  const summary = 'ROLLDOWN_SUMMARY latest=1.0.0-rc.10 total=2 all=1.0.0-rc.10,1.0.0-rc.9'

  assert.match(report, /- rolldown@/)
  assert.ok(report.includes(summary))
  assert.ok(report.indexOf(summary) > report.indexOf('- rolldown@'))
})

it('verifySingleRolldownVersion throws when lockfile resolves multiple rolldown versions', () => {
  assert.throws(() => {
    verifySingleRolldownVersion(new Map([
      ['1.0.0-rc.10', new Set(['packages/weapp-vite'])],
      ['1.0.0-rc.9', new Set(['packages/rolldown-require'])],
    ]))
  }, /multiple rolldown versions detected/)
})

it('verifySingleRolldownVersion accepts a single resolved rolldown version', () => {
  assert.doesNotThrow(() => {
    verifySingleRolldownVersion(new Map([
      ['1.0.0-rc.10', new Set(['packages/weapp-vite', 'packages/rolldown-require'])],
    ]))
  })
})

it('collectViteRolldownVersions only keeps vite snapshots that depend on rolldown', () => {
  const versions = collectViteRolldownVersions({
    snapshots: {
      'vite@7.3.1': {
        dependencies: {
          rollup: '4.59.0',
        },
      },
      'vite@8.0.0': {
        dependencies: {
          rolldown: '1.0.0-rc.9',
        },
      },
      'vite@8.0.1': {
        dependencies: {
          rolldown: '1.0.0-rc.9',
        },
      },
    },
  })

  assert.deepEqual([...versions.keys()], ['1.0.0-rc.9'])
  assert.deepEqual(
    [...(versions.get('1.0.0-rc.9') ?? [])].sort(),
    ['vite@8.0.0', 'vite@8.0.1'],
  )
})

it('resolveCatalogDependencyVersion reads rolldown from workspace catalog', () => {
  const expected = resolveCatalogDependencyVersion({
    catalog: {
      rolldown: '1.0.0-rc.9',
    },
  }, 'rolldown')

  assert.equal(expected, '1.0.0-rc.9')
})

it('resolveCatalogDependencyVersion throws when workspace catalog misses rolldown', () => {
  assert.throws(() => {
    resolveCatalogDependencyVersion({
      catalog: {},
    }, 'rolldown')
  }, /failed to resolve rolldown version from pnpm-workspace.yaml catalog/)
})

it('resolveDependencySpecVersion resolves catalog protocol through workspace catalog', () => {
  const actual = resolveDependencySpecVersion('catalog:', 'rolldown', {
    catalog: {
      rolldown: '1.0.0-rc.9',
    },
  })

  assert.equal(actual, '1.0.0-rc.9')
})

it('resolveWorkspacePackageSpecVersion resolves workspace protocol to published versions', () => {
  const workspaceVersionsByName = new Map([
    ['rolldown-require', '2.0.10'],
  ])
  const workspaceManifest = {
    catalog: {
      rolldown: '1.0.0-rc.11',
    },
  }

  assert.equal(
    resolveWorkspacePackageSpecVersion('catalog:', 'rolldown', workspaceManifest, workspaceVersionsByName),
    '1.0.0-rc.11',
  )
  assert.equal(
    resolveWorkspacePackageSpecVersion('workspace:*', 'rolldown-require', workspaceManifest, workspaceVersionsByName),
    '2.0.10',
  )
  assert.equal(
    resolveWorkspacePackageSpecVersion('workspace:^', 'rolldown-require', workspaceManifest, workspaceVersionsByName),
    '^2.0.10',
  )
})

it('collectRolldownExpectedPublishedSpecs keeps only rolldown-related dependencies', () => {
  const specs = collectRolldownExpectedPublishedSpecs(
    {
      dependencies: {
        'rolldown': 'catalog:',
        'rolldown-plugin-dts': '0.22.5',
        'rolldown-require': 'workspace:*',
        'vite': '8.0.2',
      },
    },
    {
      catalog: {
        rolldown: '1.0.0-rc.11',
      },
    },
    new Map([
      ['rolldown-require', '2.0.10'],
    ]),
  )

  assert.deepEqual(specs, [
    { section: 'dependencies', dependencyName: 'rolldown', expected: '1.0.0-rc.11' },
    { section: 'dependencies', dependencyName: 'rolldown-plugin-dts', expected: '0.22.5' },
    { section: 'dependencies', dependencyName: 'rolldown-require', expected: '2.0.10' },
  ])
})

it('collectRolldownPublishArtifactIssues reports mismatched packed manifests', () => {
  const projectRoot = '/workspace'
  const issues = collectRolldownPublishArtifactIssues(projectRoot, {
    targets: [
      {
        filePath: `${projectRoot}/packages/weapp-vite/package.json`,
        packageRoot: `${projectRoot}/packages/weapp-vite`,
        packageJson: {
          name: 'weapp-vite',
          dependencies: {
            'rolldown': 'catalog:',
            'rolldown-plugin-dts': '0.22.5',
            'rolldown-require': 'workspace:*',
          },
        },
      },
    ],
    workspaceManifest: {
      catalog: {
        rolldown: '1.0.0-rc.11',
      },
    },
    workspaceVersionsByName: new Map([
      ['rolldown-require', '2.0.10'],
    ]),
    packWorkspacePackageJsonImpl() {
      return {
        dependencies: {
          'rolldown': '1.0.0-rc.12',
          'rolldown-plugin-dts': '0.23.0',
          'rolldown-require': '2.0.10',
        },
      }
    },
  })

  assert.equal(issues.length, 2)
  assert.match(issues[0], /weapp-vite packed manifest mismatch/)
  assert.match(issues[0], /dependency: rolldown/)
  assert.match(issues[1], /dependency: rolldown-plugin-dts/)
})

it('formatRolldownWarningReport highlights multiple installed versions', () => {
  const report = formatRolldownWarningReport('/workspace', new Map([
    ['1.0.0-rc.10', new Set(['packages/weapp-vite'])],
    ['1.0.0-rc.11', new Set(['packages/rolldown-require'])],
  ]), ['install completed with multiple rolldown versions in pnpm-lock.yaml'])

  assert.match(report, /rolldown warning/)
  assert.match(report, /multiple rolldown versions detected: 1.0.0-rc.10, 1.0.0-rc.11/)
})

it('verifyRolldownCatalogReferences accepts package manifests wired to catalog', () => {
  const projectRoot = '/workspace'
  const manifests = new Map([
    [`${projectRoot}/packages/weapp-vite/package.json`, {
      dependencies: {
        rolldown: 'catalog:',
      },
    }],
    [`${projectRoot}/packages/rolldown-require/package.json`, {
      peerDependencies: {
        rolldown: 'catalog:',
      },
    }],
  ])

  assert.doesNotThrow(() => {
    verifyRolldownCatalogReferences(projectRoot, filePath => manifests.get(filePath))
  })
})

it('verifyRolldownCatalogReferences rejects literal rolldown versions in managed manifests', () => {
  const projectRoot = '/workspace'
  const manifests = new Map([
    [`${projectRoot}/packages/weapp-vite/package.json`, {
      dependencies: {
        rolldown: '1.0.0-rc.9',
      },
    }],
    [`${projectRoot}/packages/rolldown-require/package.json`, {
      peerDependencies: {
        rolldown: 'catalog:',
      },
    }],
  ])

  assert.throws(() => {
    verifyRolldownCatalogReferences(projectRoot, filePath => manifests.get(filePath))
  }, /must reference workspace catalog/)
})

it('syncRolldownCatalogReferences rewrites managed manifests back to catalog protocol', () => {
  const projectRoot = '/workspace'
  const manifests = new Map([
    [`${projectRoot}/packages/weapp-vite/package.json`, {
      dependencies: {
        rolldown: '1.0.0-rc.12',
      },
    }],
    [`${projectRoot}/packages/rolldown-require/package.json`, {
      peerDependencies: {
        rolldown: '^1.0.0-rc.12',
      },
    }],
  ])
  const writes = new Map()

  const changedFiles = syncRolldownCatalogReferences(projectRoot, {
    readPackageJsonImpl(filePath) {
      return JSON.parse(JSON.stringify(manifests.get(filePath)))
    },
    writePackageJsonImpl(filePath, packageJson) {
      writes.set(filePath, packageJson)
    },
  })

  assert.deepEqual(changedFiles, [
    `${projectRoot}/packages/weapp-vite/package.json`,
    `${projectRoot}/packages/rolldown-require/package.json`,
  ])
  assert.equal(writes.get(`${projectRoot}/packages/weapp-vite/package.json`)?.dependencies?.rolldown, 'catalog:')
  assert.equal(writes.get(`${projectRoot}/packages/rolldown-require/package.json`)?.peerDependencies?.rolldown, 'catalog:')
})

it('syncRolldownCatalogReferences keeps already-synced manifests untouched', () => {
  const projectRoot = '/workspace'
  const manifests = new Map([
    [`${projectRoot}/packages/weapp-vite/package.json`, {
      dependencies: {
        rolldown: 'catalog:',
      },
    }],
    [`${projectRoot}/packages/rolldown-require/package.json`, {
      peerDependencies: {
        rolldown: 'catalog:',
      },
    }],
  ])

  const changedFiles = syncRolldownCatalogReferences(projectRoot, {
    readPackageJsonImpl(filePath) {
      return JSON.parse(JSON.stringify(manifests.get(filePath)))
    },
    writePackageJsonImpl() {
      throw new Error('should not write synced manifests')
    },
  })

  assert.deepEqual(changedFiles, [])
})

it('verifyRolldownCatalogReferences accepts the real workspace manifests', () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

  assert.doesNotThrow(() => {
    verifyRolldownCatalogReferences(projectRoot)
  })
})

it('packWorkspacePackageJson reads the packed manifest using pnpm pack output', () => {
  const packedPackageJson = packWorkspacePackageJson(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/rolldown-require'))

  assert.equal(packedPackageJson.name, 'rolldown-require')
  assert.equal(packedPackageJson.peerDependencies.rolldown, '1.0.0-rc.11')
})

it('readPackedPackageJsonFromTarball reads package/package.json from a pnpm pack tarball', () => {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/rolldown-require')
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'rolldown-pack-test-'))

  try {
    const stdout = execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--dir', packageRoot, 'pack', '--pack-destination', tmpDir, '--json'], {
      cwd: packageRoot,
      encoding: 'utf8',
    })
    const parsed = JSON.parse(stdout)
    const tarballPath = Array.isArray(parsed) ? parsed[0].filename : parsed.filename
    const packedPackageJson = readPackedPackageJsonFromTarball(tarballPath)
    assert.equal(packedPackageJson.name, 'rolldown-require')
  }
  finally {
    rmSync(tmpDir, { force: true, recursive: true })
  }
})

it('resolveMode reads explicit report mode from cli args', () => {
  assert.equal(resolveMode(['--mode', 'report']), 'report')
  assert.equal(resolveMode(['--mode=report']), 'report')
  assert.equal(resolveMode(['--mode', 'sync']), 'sync')
  assert.equal(resolveMode([]), 'strict')
})

it('resolveAnsiEnabled disables ANSI in ci environments', () => {
  assert.equal(resolveAnsiEnabled({ CI: 'true' }, { isTTY: true }), false)
  assert.equal(resolveAnsiEnabled({ CI: '1' }, { isTTY: true }), false)
})

it('resolveAnsiEnabled keeps ANSI for local tty output', () => {
  assert.equal(resolveAnsiEnabled({}, { isTTY: true }), true)
  assert.equal(resolveAnsiEnabled({}, { isTTY: false }), true)
})

it('resolveAnsiEnabled respects explicit color overrides', () => {
  assert.equal(resolveAnsiEnabled({ FORCE_COLOR: '1', CI: 'true' }, { isTTY: false }), true)
  assert.equal(resolveAnsiEnabled({ FORCE_COLOR: '0' }, { isTTY: true }), false)
  assert.equal(resolveAnsiEnabled({ NO_COLOR: '1' }, { isTTY: true }), false)
})
