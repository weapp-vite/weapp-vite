import type { ScriptScenario } from '../types'
import { describe, expect, it } from 'vitest'
import { scriptDigest } from '../identity'
import { scriptBaselineSources } from '../installHelpers/source'
import { verifyScriptCorrectness } from './correctness'
import { correctnessReport } from './testUtils/correctness'

const scenarios: ScriptScenario[] = [
  { id: 'first', kind: 'sfc', filename: 'src/index.vue', source: '<template><view /></template>', options: { sourceMap: true }, expectWarning: false },
  { id: 'second', kind: 'reserved-props', filename: 'src/props.vue', source: 'defineProps({ id: String })', expectWarning: true },
]
const hashes = Object.fromEntries(scriptBaselineSources.map(file => [file, scriptDigest(file)]))

describe('full correctness evidence before script timings', () => {
  it('derives the same oracle for every variant and repeated call', () => {
    const result = verifyScriptCorrectness(correctnessReport(scenarios, hashes), scenarios, hashes)
    expect(result.size).toBe(2)
    expect(result.get('first')).toEqual({ inputSha256: scriptDigest(JSON.stringify(scenarios[0])), outputSha256: scriptDigest('first') })
  })

  it.each(['missing', 'input', 'output', 'warnings', 'ownership', 'source', 'loader', 'order'] as const)('rejects %s evidence despite a true passed flag', (kind) => {
    const report = correctnessReport(scenarios, hashes)
    const check = report.runs[2]!.checks[0]!
    if (kind === 'missing') {
      report.runs.pop()
    }
    if (kind === 'input') {
      check.inputSha256 = scriptDigest('other input')
    }
    if (kind === 'output') {
      check.outputSha256 = scriptDigest('other output')
    }
    if (kind === 'warnings') {
      check.warnings.push('unexpected')
    }
    if (kind === 'ownership') {
      check.metrics.pendingTransfers++
    }
    if (kind === 'source') {
      report.sourceHashes = { ...hashes, other: scriptDigest('changed') }
    }
    if (kind === 'loader') {
      report.runs[1]!.sourceHashes = {}
    }
    if (kind === 'order') {
      report.runs.reverse()
    }
    expect(() => verifyScriptCorrectness(report, scenarios, hashes)).toThrow()
  })
})
