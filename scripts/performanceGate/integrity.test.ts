import { describe, expect, it } from 'vitest'
import { assertPairedAuditComplete } from './integrity'

function artifact() {
  const ids = ['build:native:first', 'build:native:repeat']
  for (const runtime of ['classic', 'stateful-experimental']) {
    for (const phase of ['first', 'repeat']) {
      for (const action of ['edit', 'restore']) {
        ids.push(`hmr:${runtime}:native:template:${phase}:${action}`)
      }
    }
  }
  return {
    benchmark: 'templates-paired-performance',
    gate: { status: 'passed' },
    manifest: { metrics: ids },
    primary: {
      errors: [] as string[],
      samples: Array.from({ length: 20 }, (_, round) => ['baseline', 'optimized'].map(side => ({ round, side, values: ids.filter(id => !id.startsWith('build:') || round < 7).map(id => ({ id, template: 'native', phase: 'edit', output: { pageCount: 1, templateDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64) }, ms: 100 })) }))).flat(),
    },
  }
}

describe('paired artifact integrity', () => {
  it('accepts complete evidence and recomputes the status', () => {
    expect(() => assertPairedAuditComplete(artifact())).not.toThrow()
    const report = artifact()
    report.primary.samples[1]!.values[0]!.ms = 10000
    report.primary.errors.push('failed close')
    expect(() => assertPairedAuditComplete(report)).toThrow('collection failed')
  })
  it('rejects missing runtime, phase, samples and forged status', () => {
    for (const prefix of ['hmr:', 'hmr:classic:', 'build:native:first', 'hmr:stateful-experimental:native:template:first:restore']) {
      const report = artifact()
      for (const row of report.primary.samples) {
        row.values = row.values.filter(value => !value.id.startsWith(prefix))
      }
      expect(() => assertPairedAuditComplete(report)).toThrow('Missing')
    }
    const report = artifact()
    report.primary.samples.pop()
    expect(() => assertPairedAuditComplete(report)).toThrow('does not match')
  })
})
