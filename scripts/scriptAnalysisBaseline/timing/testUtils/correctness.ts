import type { ScriptScenario } from '../../types'
import { scriptDigest } from '../../identity'
import { scriptBaselineSources } from '../../installHelpers/source'
import { SCRIPT_VARIANTS } from '../../types'

/** 只用于报告校验测试，不代表真实编译输出。 */
export function correctnessReport(scenarios: ScriptScenario[], sourceHashes: Record<string, string>) {
  return {
    schemaVersion: 1,
    passed: true,
    sourcesUnchanged: true,
    sourceHashes,
    scenarios: scenarios.map(scenario => ({ id: scenario.id, sourceSha256: scriptDigest(scenario.source), inputSha256: scriptDigest(JSON.stringify(scenario)) })),
    runs: SCRIPT_VARIANTS.map(variant => ({
      variant,
      reportSha256: scriptDigest(variant),
      sourceHashes: variant === 'baseline' ? {} : Object.fromEntries(scriptBaselineSources.map(file => [file, sourceHashes[file]])),
      checks: scenarios.flatMap(scenario => [0, 1].map(iteration => ({
        scenario: scenario.id,
        iteration,
        inputSha256: scriptDigest(JSON.stringify(scenario)),
        outputSha256: scriptDigest(scenario.id),
        failed: Boolean(scenario.expectError),
        warnings: scenario.expectWarning ? ['expected diagnostic'] : [],
        metrics: { activeCompiles: 0, pendingTransfers: 0, astAlreadyConsumed: 0 },
      }))),
    })),
  }
}
