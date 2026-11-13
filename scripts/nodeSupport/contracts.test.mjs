import { describe, expect, it } from 'vitest'
import { aggregateNodeSupport, createNodeSupportPlan, minimumNodeVersions } from './contracts.mjs'

const identity = { commit: 'a'.repeat(40), repository: 'example/project', runId: '123', runAttempt: 1, os: 'linux', arch: 'x64', builderNode: '24.22.1', packageManager: 'pnpm@11.0.0' }
const minimums = { 22: '22.23.4', 24: '24.22.1', 26: '26.12.1' }
const reports = plan => plan.matrix.map(row => ({ identity: plan.identity, node: row.node, roles: row.roles, planHash: plan.planHash, status: 'passed', consumerHash: 'b'.repeat(64), dashboardHash: 'c'.repeat(64) }))

describe('complete Node support contracts with exact-version deduplication', () => {
  it('maps six logical roles onto three executions only when resolved versions coincide', () => {
    expect(minimumNodeVersions('^22.23.4 || ^24.22.1 || >=26.12.1')).toEqual(minimums)
    const plan = createNodeSupportPlan(identity, minimums, { 22: 'v22.23.4', 24: '24.22.1', 26: '26.12.1' })
    expect(plan.roles).toHaveLength(6)
    expect(plan.matrix).toHaveLength(3)
    expect(plan.matrix[0].roles).toEqual(['minimum-22', 'latest-22'])
    expect(plan.matrix[2].roles).toEqual(['minimum-26', 'latest-26'])
    expect(aggregateNodeSupport(plan, reports(plan), identity.commit).logicalRoles).toHaveLength(6)
  })

  it('keeps different minimum/latest versions as distinct executions', () => {
    const plan = createNodeSupportPlan(identity, minimums, { 22: '22.24.0', 24: '24.23.0', 26: '26.13.1' })
    expect(plan.matrix).toHaveLength(6)
    expect(() => createNodeSupportPlan(identity, minimums, { 22: '24.23.0', 24: '24.23.0', 26: '26.13.1' })).toThrow('major')
    expect(() => createNodeSupportPlan(identity, minimums, { 22: '22.24.0', 24: '24.23.0' })).toThrow('stable Node')
    expect(() => createNodeSupportPlan(identity, minimums, { 22: '22.24.0', 24: '24.23.0', 26: '26.10.0' })).toThrow('below')
    expect(() => createNodeSupportPlan(identity, minimums, { 22: '22.20.0', 24: '24.23.0', 26: '26.13.1' })).toThrow('below')
  })

  it('rejects omitted roles, duplicates, foreign plans and missing executions', () => {
    const plan = createNodeSupportPlan(identity, minimums, minimums)
    const values = reports(plan)
    expect(() => aggregateNodeSupport(plan, values.slice(1), identity.commit)).toThrow('Missing')
    expect(() => aggregateNodeSupport(plan, [values[0], values[0], values[2]], identity.commit)).toThrow('duplicate')
    const changed = structuredClone(values)
    changed[0].roles.pop()
    expect(() => aggregateNodeSupport(plan, changed, identity.commit)).toThrow('roles')
    const missingLatest26 = reports(plan)
    missingLatest26.find(report => report.roles.includes('latest-26')).roles = ['minimum-26']
    expect(() => aggregateNodeSupport(plan, missingLatest26, identity.commit)).toThrow('roles')
    expect(() => aggregateNodeSupport(plan, values, 'd'.repeat(40))).toThrow('checkout')
  })
})
