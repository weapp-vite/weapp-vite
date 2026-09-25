import type { AuditSample } from './collect'
import type { AuditBatch } from './report'
import { assertGatePassed, evaluateGate } from './evaluate'
import { assertManifestMetrics } from './manifest'
import { isOutputEvidence } from './outputEvidence'
import { pairBatch } from './report'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** artifact 是外部输入；复算门禁，不能只信任保存的 status 字段。 */
function parseBatch(value: unknown): AuditBatch {
  if (!record(value) || !Array.isArray(value.errors) || !value.errors.every(item => typeof item === 'string') || !Array.isArray(value.samples)) {
    throw new Error('Invalid paired audit batch')
  }
  const samples = value.samples.map((row): AuditBatch['samples'][number] => {
    if (!record(row) || !Number.isInteger(row.round) || Number(row.round) < 0 || (row.side !== 'baseline' && row.side !== 'optimized') || !Array.isArray(row.values)) {
      throw new Error('Invalid paired sample ownership')
    }
    const values = row.values.map((sample): AuditSample => {
      if (!record(sample) || typeof sample.id !== 'string' || typeof sample.template !== 'string' || typeof sample.phase !== 'string' || typeof sample.ms !== 'number' || !Number.isFinite(sample.ms) || sample.ms <= 0) {
        throw new Error('Invalid paired timing sample')
      }
      return { id: sample.id, template: sample.template, phase: sample.phase, ms: sample.ms, output: isOutputEvidence(sample.output) ? sample.output : undefined }
    })
    return { side: row.side, round: Number(row.round), values }
  })
  return { errors: value.errors as string[], samples }
}

export function assertPairedAuditComplete(value: unknown) {
  if (!record(value) || value.benchmark !== 'templates-paired-performance' || !record(value.gate)) {
    throw new Error('Invalid paired performance report')
  }
  const primary = parseBatch(value.primary)
  const confirmation = value.confirmation ? parseBatch(value.confirmation) : undefined
  if (primary.errors.length || confirmation?.errors.length) {
    throw new Error('Paired performance collection failed')
  }
  const scenarios = pairBatch(primary)
  if (!record(value.manifest) || !Array.isArray(value.manifest.metrics) || !value.manifest.metrics.every(item => typeof item === 'string')) {
    throw new Error('Missing performance scenario manifest')
  }
  assertManifestMetrics({ templates: [], metrics: value.manifest.metrics }, scenarios.map(row => row.id))
  const templates = new Set(primary.samples.flatMap(row => row.values.filter(sample => sample.id.startsWith('build:')).map(sample => sample.template)))
  if (!templates.size) {
    throw new Error('Missing performance template manifest')
  }
  for (const template of templates) {
    for (const phase of ['first', 'repeat']) {
      if (!scenarios.some(scenario => scenario.id === `build:${template}:${phase}`)) {
        throw new Error('Missing first/repeat build evidence')
      }
    }
    for (const runtime of ['classic', 'stateful-experimental']) {
      const matching = scenarios.filter(scenario => scenario.id.startsWith(`hmr:${runtime}:${template}:`))
      if (!matching.length) {
        throw new Error('Missing HMR runtime evidence')
      }
      const names = new Set(matching.map(scenario => scenario.id.slice(0, scenario.id.lastIndexOf(':', scenario.id.lastIndexOf(':') - 1))))
      for (const name of names) {
        for (const phase of ['first', 'repeat']) {
          for (const action of ['edit', 'restore']) {
            if (!matching.some(scenario => scenario.id === `${name}:${phase}:${action}`)) {
              throw new Error('Missing HMR edit/restore evidence')
            }
          }
        }
      }
    }
  }
  const gate = evaluateGate(scenarios, confirmation ? pairBatch(confirmation) : [])
  if (value.gate.status !== gate.status) {
    throw new Error('Stored performance gate does not match its raw samples')
  }
  assertGatePassed(gate)
}
