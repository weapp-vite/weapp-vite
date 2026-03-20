import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  collectViteRolldownVersions,
  formatRolldownVersionReport,
  resolveAnsiEnabled,
  resolveExpectedRolldownRequirePeer,
  resolveMode,
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

it('resolveExpectedRolldownRequirePeer follows vite dependency from lockfile', () => {
  const expected = resolveExpectedRolldownRequirePeer({
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
    },
  })

  assert.equal(expected, '1.0.0-rc.9')
})

it('resolveExpectedRolldownRequirePeer throws when vite rolldown versions diverge', () => {
  assert.throws(() => {
    resolveExpectedRolldownRequirePeer({
      snapshots: {
        'vite@8.0.0': {
          dependencies: {
            rolldown: '1.0.0-rc.9',
          },
        },
        'vite@8.0.1': {
          dependencies: {
            rolldown: '1.0.0-rc.10',
          },
        },
      },
    })
  }, /multiple vite rolldown versions detected/)
})

it('resolveMode reads explicit report mode from cli args', () => {
  assert.equal(resolveMode(['--mode', 'report']), 'report')
  assert.equal(resolveMode(['--mode=report']), 'report')
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
