import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

const input = process.argv[2]
if (!input) {
  throw new Error('Usage: node scripts/summarize-benchmark.mjs <observed-results.json>')
}
const catalog = JSON.parse(await readFile(new URL('../../benchmarks/weapp-agent/tasks.json', import.meta.url), 'utf8'))
const tasks = new Set(catalog.tasks.map(t => t.id))
const modes = ['host-only', 'direct-tools', 'weapp-agent']
const records = JSON.parse(await readFile(input, 'utf8'))
assert(Array.isArray(records), 'Expected an array of observed trial records')
const seen = new Set()
for (const r of records) {
  assert(tasks.has(r.taskId) && modes.includes(r.mode), 'Unknown task or mode')
  assert(typeof r.trial === 'string' && r.trial.length > 0, 'trial is required')
  assert(['passed', 'failed', 'blocked'].includes(r.outcome), 'Invalid outcome')
  assert(Number.isFinite(r.durationSeconds) && r.durationSeconds >= 0, 'Invalid duration')
  assert(Number.isInteger(r.humanTakeovers) && r.humanTakeovers >= 0, 'Invalid takeover count')
  assert(r.outcome === 'passed' || (typeof r.failureReason === 'string' && r.failureReason.length > 0), 'Failure reason required')
  assert(r.cost === undefined || (Number.isFinite(r.cost) && r.cost >= 0), 'Invalid measured cost')
  const key = JSON.stringify([r.taskId, r.trial, r.mode])
  assert(!seen.has(key), 'Duplicate task/trial/mode')
  seen.add(key)
}
function median(values) {
  if (!values.length) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const summaries = modes.map((mode) => {
  const rows = records.filter(r => r.mode === mode)
  return {
    mode,
    trials: rows.length,
    completionRate: rows.length ? rows.filter(r => r.outcome === 'passed').length / rows.length : null,
    medianDurationSeconds: median(rows.map(r => r.durationSeconds)),
    medianHumanTakeovers: median(rows.map(r => r.humanTakeovers)),
    measuredCostTrials: rows.filter(r => r.cost !== undefined).length,
    medianMeasuredCost: median(rows.filter(r => r.cost !== undefined).map(r => r.cost)),
  }
})
const paired = records.filter(r => r.mode === 'weapp-agent' && r.outcome === 'passed').flatMap((r) => {
  const baseline = records.find(b => b.mode === 'direct-tools' && b.outcome === 'passed' && b.taskId === r.taskId && b.trial === r.trial)
  return baseline ? [{ baseline: baseline.humanTakeovers, agent: r.humanTakeovers }] : []
})
const baseline = median(paired.map(p => p.baseline))
const agent = median(paired.map(p => p.agent))
console.log(JSON.stringify({
  version: 1,
  summaries,
  pairedComparison: {
    pairs: paired.length,
    baselineMedianTakeovers: baseline,
    agentMedianTakeovers: agent,
    reduction: baseline > 0 ? (baseline - agent) / baseline : null,
  },
}, null, 2))
