import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { verifyCoverageShards } from '../../coverageShards/contracts.mjs'
import { TOPOLOGY_V2_COMPARISON_PROTOCOL } from '../../verification/topology.ts'
import { classifyCoverageScope, coverageScopePolicy } from '../../verificationTelemetry/coveragePolicy.mjs'
import { coverageLogicalScope } from '../../verificationTelemetry/logicalCoverage.mjs'
import { runtimeOs, verificationResource } from '../../verificationTelemetry/os.mjs'
import { evidenceDigest, runtimeScope } from '../evidence.mjs'
import { readArtifactDocuments } from './artifacts.mjs'
import { assertCiExecutionTopology } from './executionTopology.mjs'
import { readTaskSuite } from './taskSuite.mjs'

async function coverageScope(descriptor, context, read) {
  const plan = await read(descriptor.plan)
  assert(plan.identity?.commit === context.checkoutSha, 'Coverage evidence checkout mismatch')
  for (const key of ['os', 'nodeMajor', 'nodeVersion', 'packageManager', 'arch']) {
    assert(descriptor.profile?.[key] === plan.identity[key], 'Coverage evidence resource profile mismatch')
  }
  assert(Array.isArray(descriptor.shards), 'Missing coverage shard references')
  const reports = []
  for (const shard of descriptor.shards) {
    const report = await read(shard)
    const bytes = await read({ artifact: shard.artifact, file: shard.blob }, false)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), report.blobHash, 'Coverage execution blob mismatch')
    reports.push(report)
  }
  verifyCoverageShards(plan, reports, plan.identity)
  const verdict = await read(descriptor.verdict)
  assert(verdict.schemaVersion === 1 && verdict.status === 'passed' && verdict.planHash === plan.planHash
    && verdict.shards === plan.shards && verdict.tests === plan.inventory.length, 'Missing successful original coverage thresholds verdict')
  assert(descriptor.scopeLevel === undefined || ['logical-cases', 'audited-cases'].includes(descriptor.scopeLevel), 'Unsupported coverage scope level')
  const logical = descriptor.scopeLevel === undefined ? null : coverageLogicalScope(plan, reports)
  const audited = descriptor.scopeLevel === 'audited-cases'
  const scope = audited ? classifyCoverageScope(logical, descriptor.scopePolicy) : logical ?? plan.inventory
  if (audited) {
    assert.deepEqual(descriptor.scopePolicy, coverageScopePolicy, 'Missing coverage classification policy')
  }
  return {
    scope,
    ...(audited
      ? {
          comparisonScope: { policy: scope.policy, product: scope.product },
          scopeSummary: Object.fromEntries(['product', 'validation'].map(category => [category, { files: scope[category].files.length, cases: scope[category].cases.length }])),
        }
      : {}),
    resource: verificationResource({ os: plan.identity.os, arch: plan.identity.arch, toolchain: { nodeVersion: plan.identity.nodeVersion, actualPackageManager: plan.identity.packageManager } }, { ...plan.identity, nodeMajor: Number(plan.identity.nodeMajor) }),
  }
}

async function suiteScope(descriptor, context, read, contract) {
  const report = await read(descriptor.suite)
  assert(report.commitSha === context.checkoutSha, 'Runtime evidence checkout mismatch')
  const formalV2 = contract.comparisonProtocol === TOPOLOGY_V2_COMPARISON_PROTOCOL
  if (formalV2) {
    assertCiExecutionTopology(report.execution?.executionTopology, context)
    assert.equal(report.execution.profile?.provider, contract.profile.provider, 'Actual runtime provider differs from the frozen benchmark contract')
  }
  assert(Array.isArray(descriptor.acceptance), 'Missing runtime acceptance references')
  const acceptance = (await Promise.all(descriptor.acceptance.map(reference => read(reference, true, true)))).flat()
  const toolchain = await read(descriptor.toolchain)
  assert(toolchain.schemaVersion === 2 && toolchain.commit === context.checkoutSha, 'Runtime toolchain checkout mismatch')
  assert(acceptance.every(value => value.environment?.nodeVersion === toolchain.toolchain?.nodeVersion), 'Runtime evidence Node version mismatch')
  const scope = runtimeScope(report, acceptance)
  return { scope, ...(formalV2 ? { comparisonScope: { provider: report.execution.profile.provider, cases: scope } } : {}), resource: verificationResource(toolchain, report.execution?.profile) }
}

/** 版本化预期必须与实际完整执行证据相等，否则只保留原始时间，不产生成功样本。 */
export async function readExecutionEvidence(contract, context, download, configuration) {
  if (!Array.isArray(contract.evidence) || !contract.evidence.length) {
    return { complete: false, reason: 'Immutable contract has no actual execution evidence references' }
  }
  try {
    assert.deepEqual(contract.needs, configuration.needs, 'CI topology differs from its immutable contract')
    assert.deepEqual(contract.outOfScope ?? {}, configuration.outOfScope ?? {}, 'CI skipped jobs differ from their immutable contract')
    const entries = []
    const resources = []
    const aggregates = []
    const ids = new Set()
    const read = async (reference, json = true, multiple = false) => {
      const documents = await readArtifactDocuments(reference, download)
      assert(multiple || documents.length === 1, 'Execution artifact needs one document')
      const values = documents.map(bytes => json ? JSON.parse(bytes.toString('utf8')) : bytes)
      return multiple ? values : values[0]
    }
    for (const descriptor of contract.evidence) {
      assert(typeof descriptor.id === 'string' && descriptor.id && !ids.has(descriptor.id), 'Duplicate or missing logical execution evidence id')
      ids.add(descriptor.id)
      const readers = { 'coverage': coverageScope, 'runtime': suiteScope, 'task-suite': readTaskSuite }
      assert(Object.hasOwn(readers, descriptor.kind), 'Unsupported execution evidence kind')
      const observed = await readers[descriptor.kind](descriptor, context, read, contract)
      assert.deepEqual(observed.scope, descriptor.scope, 'Actual execution scope differs from the immutable contract')
      assert(Object.values(observed.resource).every(value => typeof value === 'string' && value), 'Missing actual execution resource identity')
      resources.push(observed.resource)
      if (observed.aggregateReceipt) {
        aggregates.push({ id: descriptor.id, report: observed.aggregateReceipt })
      }
      entries.push({ id: descriptor.id, kind: descriptor.kind, scope: observed.scope, ...(observed.comparisonScope ? { comparisonScope: observed.comparisonScope, scopeSummary: observed.scopeSummary } : {}) })
    }
    entries.sort((left, right) => left.id.localeCompare(right.id))
    const unique = values => [...new Set(values.map(value => JSON.stringify(value)))].sort()
    const profile = {
      ...contract.profile,
      os: JSON.stringify(unique(resources.map(({ os, arch }) => ({ os: runtimeOs(os), arch })))),
      node: JSON.stringify(unique(resources.map(({ nodeVersion, packageManager }) => ({ nodeVersion, packageManager })))),
    }
    const comparison = entries.map(({ id, kind, scope, comparisonScope }) => ({ id, kind, scope: comparisonScope ?? scope }))
    return { complete: true, scopeDigest: evidenceDigest(comparison), inventories: entries, resources, profile, ...(aggregates.length ? { aggregates } : {}) }
  }
  catch (error) {
    return { complete: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
