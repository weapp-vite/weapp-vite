import { createHash } from 'node:crypto'

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
  if (sample.outcome === 'passed') {
    positive(sample.metrics.executionMs, 'executionMs', false)
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
      samples: cohort.map(sample => sample.id),
      medians: Object.fromEntries(metrics.map(key => [key, median(cohort.map(sample => sample.metrics[key]))])),
    }]
  }))
  const reduction = 1 - cohorts.candidate.medians.executionMs / cohorts.baseline.medians.executionMs
  return {
    schemaVersion: 1,
    identityDigest: createHash('sha256').update(`${identity}:${scope}`).digest('hex'),
    inputDigest: successful[0].inputDigest,
    scopeDigest: scope,
    profile: successful[0].profile,
    cohorts,
    excluded: samples.filter(sample => sample.outcome !== 'passed').map(sample => ({ id: sample.id, outcome: sample.outcome })),
    reduction,
    targetReduction,
    meetsTarget: reduction >= targetReduction,
  }
}
