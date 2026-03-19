import assert from 'node:assert/strict'
import test from 'vitest'

import { formatRolldownVersionReport } from './print-rolldown-versions.mjs'

test('formatRolldownVersionReport appends a compact summary after detailed sections', () => {
  const report = formatRolldownVersionReport('/workspace', new Map([
    ['1.0.0-rc.10', new Set(['packages/weapp-vite'])],
    ['1.0.0-rc.9', new Set(['packages/rolldown-require'])],
  ]))

  const summary = 'rolldown summary: latest=1.0.0-rc.10; all=1.0.0-rc.10, 1.0.0-rc.9'

  assert.match(report, /- rolldown@/)
  assert.ok(report.includes(summary))
  assert.ok(report.indexOf(summary) > report.indexOf('- rolldown@'))
})
