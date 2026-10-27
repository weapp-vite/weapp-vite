import { describe, expect, it } from 'vitest'
import { aggregateConsumerBatches, consumerScenarios, createConsumerBatchPlan } from './contracts.mjs'

const identity = { commit: 'a'.repeat(40), repository: 'example/project', runId: '123', runAttempt: 1, os: 'linux', arch: 'x64', builderNode: '24.22.1', packageManager: 'pnpm@11.0.0' }
const reportFixture = plan => [1, 2, 3, 4].map(shardIndex => ({ identity: plan.identity, planHash: plan.planHash, shardIndex, status: 'passed', results: plan.tasks.filter(task => task.shardIndex === shardIndex).map(task => ({ id: task.id, profile: task.profile, status: 'passed', exitCode: 0, durationMs: 1, evidenceHash: 'b'.repeat(64) })) }))

describe('complete consumer batches', () => {
  it('retains all 32 host/profile contracts and distributes static weights deterministically', () => {
    const plan = createConsumerBatchPlan(identity)
    expect(consumerScenarios()).toHaveLength(32)
    expect(new Set(plan.tasks.map(task => task.id)).size).toBe(32)
    expect(plan.tasks.some(task => task.id === 'wv/classic-watch')).toBe(false)
    expect(plan.weightSource).toBe('static-relative-v1')
    const weights = [1, 2, 3, 4].map(index => plan.tasks.filter(task => task.shardIndex === index).reduce((sum, task) => sum + task.weight, 0))
    expect(Math.max(...weights) - Math.min(...weights)).toBeLessThanOrEqual(8)
    expect(createConsumerBatchPlan(identity)).toEqual(plan)
    expect(aggregateConsumerBatches(plan, reportFixture(plan), identity.commit).scenarios).toHaveLength(32)
  })

  it('refuses missing, duplicate, failed or mismatched scenario evidence', () => {
    const plan = createConsumerBatchPlan(identity)
    const reports = reportFixture(plan)
    expect(() => aggregateConsumerBatches(plan, reports.slice(1), identity.commit)).toThrow('Missing')
    expect(() => aggregateConsumerBatches(plan, [reports[0], reports[0], reports[2], reports[3]], identity.commit)).toThrow('Duplicate')
    const missing = structuredClone(reports)
    missing[0].results.pop()
    expect(() => aggregateConsumerBatches(plan, missing, identity.commit)).toThrow('inventory')
    const failed = structuredClone(reports)
    failed[0].results[0].status = 'not-executed'
    expect(() => aggregateConsumerBatches(plan, failed, identity.commit)).toThrow('evidence')
    expect(() => aggregateConsumerBatches(plan, reports, 'c'.repeat(40))).toThrow('checkout')
  })
})
