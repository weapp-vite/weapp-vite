import assert from 'node:assert/strict'
import test from 'vitest'

import { formatRolldownVersionReport, resolveAnsiEnabled, resolveMode, verifySingleRolldownVersion } from './print-rolldown-versions.mjs'

test('formatRolldownVersionReport appends a compact summary after detailed sections', () => {
  const report = formatRolldownVersionReport('/workspace', new Map([
    ['1.0.0-rc.10', new Set(['packages/weapp-vite'])],
    ['1.0.0-rc.9', new Set(['packages/rolldown-require'])],
  ]))

  const summary = 'ROLLDOWN_SUMMARY latest=1.0.0-rc.10 total=2 all=1.0.0-rc.10,1.0.0-rc.9'

  assert.match(report, /- rolldown@/)
  assert.ok(report.includes(summary))
  assert.ok(report.indexOf(summary) > report.indexOf('- rolldown@'))
})

test('verifySingleRolldownVersion throws when lockfile resolves multiple rolldown versions', () => {
  assert.throws(() => {
    verifySingleRolldownVersion(new Map([
      ['1.0.0-rc.10', new Set(['packages/weapp-vite'])],
      ['1.0.0-rc.9', new Set(['packages/rolldown-require'])],
    ]))
  }, /multiple rolldown versions detected/)
})

test('verifySingleRolldownVersion accepts a single resolved rolldown version', () => {
  assert.doesNotThrow(() => {
    verifySingleRolldownVersion(new Map([
      ['1.0.0-rc.10', new Set(['packages/weapp-vite', 'packages/rolldown-require'])],
    ]))
  })
})

test('resolveMode reads explicit report mode from cli args', () => {
  assert.equal(resolveMode(['--mode', 'report']), 'report')
  assert.equal(resolveMode(['--mode=report']), 'report')
  assert.equal(resolveMode([]), 'strict')
})

test('resolveAnsiEnabled disables ANSI in ci environments', () => {
  assert.equal(resolveAnsiEnabled({ CI: 'true' }, { isTTY: true }), false)
  assert.equal(resolveAnsiEnabled({ CI: '1' }, { isTTY: true }), false)
})

test('resolveAnsiEnabled keeps ANSI for local tty output', () => {
  assert.equal(resolveAnsiEnabled({}, { isTTY: true }), true)
  assert.equal(resolveAnsiEnabled({}, { isTTY: false }), true)
})

test('resolveAnsiEnabled respects explicit color overrides', () => {
  assert.equal(resolveAnsiEnabled({ FORCE_COLOR: '1', CI: 'true' }, { isTTY: false }), true)
  assert.equal(resolveAnsiEnabled({ FORCE_COLOR: '0' }, { isTTY: true }), false)
  assert.equal(resolveAnsiEnabled({ NO_COLOR: '1' }, { isTTY: true }), false)
})
