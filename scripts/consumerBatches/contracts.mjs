import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { assertFrozenConsumerIdentity } from './identity.mjs'

export const consumerHosts = ['wv', 'vite', 'vite-plus']
const weights = { 'consumer': 4, 'stateful': 6, 'classic': 6, 'classic-watch': 7, 'react': 4, 'independent': 4, 'worker': 5, 'plugin': 5, 'lib': 7, 'platform': 8, 'web': 7 }
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** 权重是明确标记的静态相对值；每轮报告另存真实耗时，不能冒充历史测量。 */
export function consumerScenarios() {
  return Object.entries(weights).flatMap(([profile, weight]) => consumerHosts
    .filter(host => profile !== 'classic-watch' || host !== 'wv')
    .map(host => ({ id: `${host}/${profile}`, host, profile, weight, installPlaywright: profile === 'web' })))
}

export function createConsumerBatchPlan(identity, shards = 4) {
  assert.equal(shards, 4, 'Consumer v2 requires four complete batches')
  assertFrozenConsumerIdentity(identity)
  const totals = Array.from({ length: shards }).fill(0)
  const tasks = consumerScenarios().sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id)).map((task) => {
    const shardIndex = totals.indexOf(Math.min(...totals)) + 1
    totals[shardIndex - 1] += task.weight
    return { ...task, shardIndex }
  }).sort((left, right) => left.id.localeCompare(right.id))
  const content = { schemaVersion: 1, identity, weightSource: 'static-relative-v1', shards, tasks }
  return { ...content, planHash: hash(content) }
}

export function assertConsumerBatchPlan(plan) {
  const { planHash, ...content } = plan ?? {}
  assert.equal(planHash, hash(content), 'Consumer batch plan digest mismatch')
  assert.deepEqual(plan, createConsumerBatchPlan(plan.identity, plan.shards), 'Consumer scenario inventory or assignment changed')
}

/** 所有逻辑场景必须严格执行一次，单个成功批次不能代表全部消费者通过。 */
export function aggregateConsumerBatches(plan, reports, commit) {
  assertConsumerBatchPlan(plan)
  assert.equal(plan.identity.commit, commit, 'Consumer aggregate checkout mismatch')
  assert.equal(reports.length, plan.shards, 'Missing consumer batch reports')
  const seen = new Set()
  for (const report of reports) {
    assert.deepEqual(report.identity, plan.identity, 'Consumer batch execution identity mismatch')
    assert.equal(report.planHash, plan.planHash, 'Consumer batch belongs to another plan')
    assert.equal(report.status, 'passed', 'Consumer batch did not pass')
    assert(!seen.has(report.shardIndex), 'Duplicate consumer batch')
    seen.add(report.shardIndex)
    const expected = plan.tasks.filter(task => task.shardIndex === report.shardIndex).map(task => task.id).sort()
    assert.deepEqual(report.results.map(result => result.id).sort(), expected, 'Consumer batch inventory incomplete')
    assert(report.results.every(result => result.profile === plan.tasks.find(task => task.id === result.id)?.profile && result.status === 'passed' && result.exitCode === 0 && Number.isFinite(result.durationMs) && result.durationMs >= 0 && /^[a-f\d]{64}$/u.test(result.evidenceHash)), 'Invalid consumer scenario evidence')
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4], 'Consumer batches are incomplete')
  return { schemaVersion: 1, planHash: plan.planHash, identity: plan.identity, status: 'passed', scenarios: reports.flatMap(report => report.results).sort((left, right) => left.id.localeCompare(right.id)) }
}
