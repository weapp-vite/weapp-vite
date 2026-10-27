import { createHash } from 'node:crypto'
import { assertVerificationTopology, comparisonTopology, TOPOLOGY_COMPARISON_PROTOCOL, TOPOLOGY_V2_COMPARISON_PROTOCOL } from '../verification/topology.ts'

const outcomes = ['passed', 'failed', 'partial', 'cancelled', 'blocked']
const profiles = ['os', 'node', 'provider', 'platform', 'runnerClass', 'cachePolicy']
const optionalProfiles = ['arch', 'packageManager', 'ideVersion', 'baseLibraryVersion']
const metrics = ['approvalWaitMs', 'schedulingWaitMs', 'executionMs', 'runnerMs']

function positive(value, name, allowZero = true) {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`Invalid ${name}`)
  }
}

/** 相同输入与资源策略才能比较；失败和局部样本保留但不进入成功中位数。 */
export function validateSample(sample) {
  if (sample?.schemaVersion !== 1 || !['baseline', 'candidate'].includes(sample.variant)
    || !outcomes.includes(sample.outcome) || !sample.id || !sample.revision) {
    throw new Error('Invalid benchmark sample identity')
  }
  if (sample.comparisonProtocol !== undefined && ![TOPOLOGY_COMPARISON_PROTOCOL, TOPOLOGY_V2_COMPARISON_PROTOCOL].includes(sample.comparisonProtocol)) {
    throw new Error('Unknown benchmark comparison protocol')
  }
  if (sample.measurement !== undefined && !['ci', 'local'].includes(sample.measurement)) {
    throw new Error('Unknown benchmark measurement kind')
  }
  if (sample.comparisonProtocol === TOPOLOGY_V2_COMPARISON_PROTOCOL && sample.profile?.runnerClass !== 'local' && sample.measurement !== 'ci') {
    throw new Error('Formal v2 CI samples require an explicit CI measurement kind')
  }
  if (sample.executionTopology !== undefined || sample.comparisonProtocol) {
    assertVerificationTopology(sample.executionTopology)
  }
  if (sample.comparisonProtocol
    && sample.executionTopology.id !== comparisonTopology(sample.comparisonProtocol, sample.variant)) {
    throw new Error('Benchmark cohort has the wrong reviewed topology')
  }
  for (const key of ['inputDigest', 'scopeDigest', 'sourceFingerprint']) {
    if (!/^[a-f\d]{64}$/u.test(sample[key])) {
      throw new Error(`Invalid ${key}`)
    }
  }
  for (const key of profiles) {
    if (typeof sample.profile?.[key] !== 'string' || !sample.profile[key]) {
      throw new Error(`Missing benchmark profile: ${key}`)
    }
  }
  for (const key of optionalProfiles) {
    if (Object.hasOwn(sample.profile, key) && (typeof sample.profile[key] !== 'string' || !sample.profile[key].trim())) {
      throw new Error(`Invalid optional benchmark profile: ${key}`)
    }
  }
  for (const key of metrics) {
    positive(sample.metrics?.[key], key)
  }
  if (sample.metrics?.approvalToCompletionMs !== undefined
    || (sample.comparisonProtocol === TOPOLOGY_V2_COMPARISON_PROTOCOL && sample.measurement === 'ci')) {
    positive(sample.metrics?.approvalToCompletionMs, 'approvalToCompletionMs', false)
  }
  if (sample.outcome === 'passed') {
    positive(sample.metrics.executionMs, 'executionMs', false)
    positive(sample.metrics.runnerMs, 'runnerMs', false)
    if (sample.complete !== true) {
      throw new Error('A partial sample cannot claim success')
    }
  }
  return sample
}

export function median(values) {
  if (!values.length) {
    throw new Error('Cannot calculate an empty median')
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** 每类至少三轮实际成功样本；不把离线估算或缓存策略变化当成实测提速。 */
export function compareSamples(samples, { minimumSamples = 3, targetReduction = 0.3 } = {}) {
  if (!Number.isInteger(minimumSamples) || minimumSamples < 3
    || !Number.isFinite(targetReduction) || targetReduction <= 0 || targetReduction >= 1) {
    throw new Error('Invalid benchmark comparison policy')
  }
  const ids = new Set()
  let identity
  let scope
  for (const sample of samples) {
    validateSample(sample)
    if (ids.has(sample.id)) {
      throw new Error(`Duplicate benchmark sample: ${sample.id}`)
    }
    ids.add(sample.id)
    if (sample.outcome !== 'passed') {
      continue
    }
    const value = JSON.stringify([sample.inputDigest, [...profiles, ...optionalProfiles].map(key => sample.profile[key] ?? null)])
    if (identity && identity !== value) {
      throw new Error('Benchmark inputs, scope or resource profile differ')
    }
    identity = value
    if (scope && scope !== sample.scopeDigest) {
      throw new Error('Benchmark scope differs')
    }
    scope = sample.scopeDigest
  }
  const successful = samples.filter(sample => sample.outcome === 'passed')
  const protocol = samples.find(sample => sample.comparisonProtocol)?.comparisonProtocol
  if (protocol && (samples.some(sample => sample.comparisonProtocol !== protocol)
    || new Set(successful.map(sample => `${sample.revision}:${sample.sourceFingerprint}`)).size !== 1
    || new Set(successful.filter(sample => sample.variant === 'baseline').map(sample => sample.executionTopology.policyDigest)).size !== 1
    || new Set(successful.filter(sample => sample.variant === 'candidate').map(sample => sample.executionTopology.policyDigest)).size !== 1)) {
    throw new Error('Topology comparison requires one final revision, source and reviewed policy on both sides')
  }
  if (protocol === TOPOLOGY_V2_COMPARISON_PROTOCOL && new Set(samples.map(sample => sample.measurement ?? 'local')).size !== 1) {
    throw new Error('Formal v2 comparison cannot mix CI and local measurements')
  }
  const ciComparison = protocol === TOPOLOGY_V2_COMPARISON_PROTOCOL && successful[0]?.measurement === 'ci'
  const comparisonMetrics = ciComparison ? [...metrics, 'approvalToCompletionMs'] : metrics
  const reductionMetric = ciComparison ? 'approvalToCompletionMs' : 'executionMs'
  const cohorts = Object.fromEntries(['baseline', 'candidate'].map((variant) => {
    const cohort = successful.filter(sample => sample.variant === variant)
    if (cohort.length < minimumSamples) {
      throw new Error(`Need ${minimumSamples} complete successful ${variant} samples`)
    }
    if (new Set(cohort.map(sample => `${sample.revision}:${sample.sourceFingerprint}`)).size !== 1) {
      throw new Error(`Source changed during ${variant} sampling`)
    }
    return [variant, {
      revision: cohort[0].revision,
      ...(protocol ? { executionTopology: cohort[0].executionTopology } : {}),
      samples: cohort.map(sample => sample.id),
      medians: Object.fromEntries(comparisonMetrics.map(key => [key, median(cohort.map(sample => sample.metrics[key]))])),
    }]
  }))
  const policies = protocol ? ['baseline', 'candidate'].map(variant => cohorts[variant].executionTopology.policyDigest) : []
  const reduction = 1 - cohorts.candidate.medians[reductionMetric] / cohorts.baseline.medians[reductionMetric]
  return {
    schemaVersion: 1,
    ...(protocol ? { comparisonProtocol: protocol } : {}),
    ...(ciComparison ? { measurement: 'ci', reductionMetric } : {}),
    identityDigest: createHash('sha256').update(`${identity}:${scope}${protocol ? `:${protocol}:${JSON.stringify(policies)}` : ''}${ciComparison ? ':ci:approvalToCompletionMs' : ''}`).digest('hex'),
    inputDigest: successful[0].inputDigest,
    scopeDigest: scope,
    profile: successful[0].profile,
    cohorts,
    excluded: samples.filter(sample => sample.outcome !== 'passed').map(sample => ({ id: sample.id, outcome: sample.outcome })),
    reduction,
    targetReduction,
    runnerReduction: 1 - cohorts.candidate.medians.runnerMs / cohorts.baseline.medians.runnerMs,
    meetsTarget: reduction >= targetReduction && cohorts.candidate.medians.runnerMs <= cohorts.baseline.medians.runnerMs,
  }
}
