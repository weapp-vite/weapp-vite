import type { ScriptScenario } from '../types'
import { isDeepStrictEqual } from 'node:util'
import { scriptDigest } from '../identity'
import { scriptBaselineSources } from '../installHelpers/source'
import { SCRIPT_VARIANTS } from '../types'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid correctness record')
  }
  return value as Record<string, unknown>
}

/** 采样前重新核对完整正确性摘要，防止通过标志掩盖缺场景或输入漂移。 */
export function verifyScriptCorrectness(value: unknown, scenarios: ScriptScenario[], sourceHashes: Record<string, string>) {
  const report = object(value)
  if (report.schemaVersion !== 1 || report.passed !== true || report.failure || report.sourcesUnchanged !== true
    || !isDeepStrictEqual(report.sourceHashes, sourceHashes) || !Array.isArray(report.runs) || report.runs.length !== SCRIPT_VARIANTS.length
    || !Array.isArray(report.scenarios) || report.scenarios.length !== scenarios.length) {
    throw new Error('Correctness report is incomplete or sources changed')
  }
  const oracle = new Map<string, { inputSha256: string, outputSha256: string }>()
  for (const [index, scenario] of scenarios.entries()) {
    const metadata = object(report.scenarios[index])
    if (metadata.id !== scenario.id || metadata.sourceSha256 !== scriptDigest(scenario.source)
      || metadata.inputSha256 !== scriptDigest(JSON.stringify(scenario))) {
      throw new Error('Correctness scenario identity differs')
    }
  }
  for (const [variantIndex, variant] of SCRIPT_VARIANTS.entries()) {
    const run = object(report.runs[variantIndex])
    const loaded = variant === 'baseline' ? {} : Object.fromEntries(scriptBaselineSources.map(filename => [filename, sourceHashes[filename]]))
    if (run.variant !== variant || typeof run.reportSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(run.reportSha256)
      || !isDeepStrictEqual(run.sourceHashes, loaded) || !Array.isArray(run.checks) || run.checks.length !== scenarios.length * 2) {
      throw new Error(`${variant}: invalid correctness coverage`)
    }
    for (const [index, raw] of run.checks.entries()) {
      const check = object(raw)
      const metrics = object(check.metrics)
      const scenario = scenarios[Math.floor(index / 2)]!
      const inputSha256 = scriptDigest(JSON.stringify(scenario))
      if (check.scenario !== scenario.id || check.iteration !== index % 2 || check.failed !== Boolean(scenario.expectError)
        || check.inputSha256 !== inputSha256 || typeof check.outputSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(check.outputSha256)
        || !Array.isArray(check.warnings) || (scenario.expectWarning !== undefined && Boolean(check.warnings.length) !== scenario.expectWarning)
        || metrics.activeCompiles || metrics.pendingTransfers || metrics.astAlreadyConsumed) {
        throw new Error(`${variant}/${scenario.id}: invalid correctness result`)
      }
      const previous = oracle.get(scenario.id)
      const current = { inputSha256, outputSha256: check.outputSha256 }
      if (previous && !isDeepStrictEqual(previous, current)) {
        throw new Error(`${variant}/${scenario.id}: correctness outputs differ`)
      }
      oracle.set(scenario.id, current)
    }
  }
  return oracle
}
