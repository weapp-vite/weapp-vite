import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { assertFrozenConsumerIdentity } from '../consumerBatches/identity.mjs'

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)$/u

export function normalizedNodeVersion(value) {
  const parts = versionPattern.exec(String(value))
  assert(parts, 'Expected an exact stable Node version')
  return parts.slice(1).join('.')
}

/** 支持下限来自正式 engines，浮动版本由 setup-node 当轮解析后冻结。 */
export function minimumNodeVersions(engines) {
  const values = String(engines).split('||').map(value => value.trim().match(/^(?:\^|>=)(\d+\.\d+\.\d+)$/u)?.[1])
  assert(values.length === 3 && values.every(Boolean), 'Unsupported Node engines contract')
  return Object.fromEntries(values.map(value => [value.split('.')[0], value]))
}

export function createNodeSupportPlan(identity, minimums, latest) {
  assertFrozenConsumerIdentity(identity)
  const roles = [22, 24, 26].map(major => ({ id: `minimum-${major}`, node: normalizedNodeVersion(minimums[major]) }))
  for (const major of [22, 24]) {
    const node = normalizedNodeVersion(latest[major])
    assert.equal(Number(node.split('.')[0]), major, 'Floating Node major mismatch')
    const comparison = (left, right) => left.split('.').map(Number).reduce((result, part, index) => result || part - Number(right.split('.')[index]), 0)
    assert(comparison(node, minimums[major]) >= 0, 'Floating Node version is below its support minimum')
    roles.push({ id: `latest-${major}`, node })
  }
  const matrix = [...new Set(roles.map(role => role.node))].sort((left, right) => left.localeCompare(right, 'en', { numeric: true })).map(node => ({
    id: `node-${node.replaceAll('.', '-')}`,
    node,
    roles: roles.filter(role => role.node === node).map(role => role.id),
  }))
  const content = { schemaVersion: 1, identity, roles, matrix }
  return { ...content, planHash: hash(content) }
}

export function assertNodeSupportPlan(plan) {
  const { planHash, ...content } = plan ?? {}
  assert.equal(planHash, hash(content), 'Node support plan digest mismatch')
  const minimums = Object.fromEntries(plan.roles.filter(role => role.id.startsWith('minimum-')).map(role => [role.id.slice(8), role.node]))
  const latest = Object.fromEntries(plan.roles.filter(role => role.id.startsWith('latest-')).map(role => [role.id.slice(7), role.node]))
  assert.deepEqual(plan, createNodeSupportPlan(plan.identity, minimums, latest), 'Node support role inventory changed')
}

/** 相同完整版本可共用一次执行；最低版与最新版的逻辑支持合同仍逐项验收。 */
export function aggregateNodeSupport(plan, reports, commit) {
  assertNodeSupportPlan(plan)
  assert.equal(plan.identity.commit, commit, 'Node support checkout mismatch')
  assert.equal(reports.length, plan.matrix.length, 'Missing Node support execution')
  const seen = new Set()
  for (const report of reports) {
    const expected = plan.matrix.find(row => row.node === report.node)
    assert(expected && !seen.has(report.node), 'Unexpected or duplicate Node support execution')
    seen.add(report.node)
    assert.deepEqual(report.identity, plan.identity, 'Node support execution identity mismatch')
    assert.equal(report.planHash, plan.planHash, 'Node support execution belongs to another plan')
    assert.equal(report.status, 'passed', 'Node support execution failed')
    assert.deepEqual(report.roles, expected.roles, 'Node support logical roles are incomplete')
    assert(/^[a-f\d]{64}$/u.test(report.consumerHash) && /^[a-f\d]{64}$/u.test(report.dashboardHash), 'Missing Node consumer evidence digest')
  }
  return { schemaVersion: 1, identity: plan.identity, planHash: plan.planHash, status: 'passed', logicalRoles: plan.roles, physicalExecutions: reports.length }
}
