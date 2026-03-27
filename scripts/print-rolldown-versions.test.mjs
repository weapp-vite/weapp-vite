import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

import {
  collectViteRolldownVersions,
  formatRolldownVersionReport,
  resolveAnsiEnabled,
  resolveCatalogDependencyVersion,
  resolveDependencySpecVersion,
  resolveMode,
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
