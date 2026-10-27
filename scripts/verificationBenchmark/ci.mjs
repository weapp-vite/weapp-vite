// eslint-disable-next-line e18e/ban-dependencies -- 只读 GitHub API 沿用已登录 gh，避免接触令牌。
import { execa } from 'execa'
import { readCiContract } from './ci/contract.mjs'
import { readExecutionEvidence } from './ci/evidence.mjs'
import { withCiRun } from './ci/github.mjs'
import { validateCiConfiguration, validateCiContext, validateCiRun } from './ci/identity.mjs'
import { readCiWorkload } from './ci/workload.mjs'
import { validateSample } from './compare.mjs'
import { evidenceDigest } from './evidence.mjs'

function timestamp(value) {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    throw new TypeError('Invalid CI timestamp')
  }
  return parsed
}

/** needs 必须覆盖 API 返回的完整 job 集合；缺图时不能把 runner 分钟当作关键路径。 */
export function ciCriticalPath(jobs, needs) {
  const topology = needs.needs ?? needs
  const outOfScope = needs.needs ? needs.outOfScope ?? {} : {}
  const rows = new Map()
  const seen = new Set()
  const skipped = new Map()
  for (const job of jobs) {
    if (job.status !== 'completed') {
      throw new Error('CI benchmark needs unique complete successful jobs')
    }
    seen.add(job.name)
    if (Object.hasOwn(outOfScope, job.name)) {
      const declaration = outOfScope[job.name]
      const reason = typeof declaration === 'string' ? declaration : declaration?.reason
      const expectedCount = typeof declaration === 'string' ? 1 : declaration?.expectedCount
      if (job.conclusion !== 'skipped' || typeof reason !== 'string' || !reason.trim() || Object.hasOwn(topology, job.name)
        || !Number.isSafeInteger(expectedCount) || expectedCount < 1) {
        throw new Error('CI out-of-scope jobs must be explicitly explained and skipped')
      }
      skipped.set(job.name, { count: (skipped.get(job.name)?.count ?? 0) + 1, expectedCount })
      continue
    }
    if (rows.has(job.name) || job.conclusion !== 'success') {
      throw new Error('CI benchmark needs unique complete successful jobs')
    }
    const durationMs = timestamp(job.completed_at) - timestamp(job.started_at)
    if (durationMs < 0) {
      throw new Error('CI job has a negative duration')
    }
    rows.set(job.name, { job, durationMs })
  }
  if (!rows.size || Object.keys(topology).length !== rows.size || Object.keys(topology).some(name => !rows.has(name))
    || Object.keys(outOfScope).some(name => !seen.has(name)) || [...skipped.values()].some(value => value.count !== value.expectedCount)) {
    throw new Error('CI topology must cover every measured job exactly once')
  }
  const pending = new Set(rows.keys())
  const paths = new Map()
  while (pending.size) {
    let progressed = false
    for (const name of pending) {
      const dependencies = topology[name]
      if (!Array.isArray(dependencies) || new Set(dependencies).size !== dependencies.length || dependencies.some(parent => !rows.has(parent))) {
        throw new Error('CI topology has missing or duplicate dependencies')
      }
      if (!dependencies.every(parent => paths.has(parent))) {
        continue
      }
      if (dependencies.some(parent => timestamp(rows.get(parent).job.completed_at) > timestamp(rows.get(name).job.started_at))) {
        throw new Error('CI topology contradicts observed job ordering')
      }
      const parent = dependencies.reduce((best, key) => paths.get(key).durationMs > best.durationMs ? paths.get(key) : best, { durationMs: 0, jobs: [] })
      paths.set(name, { durationMs: parent.durationMs + rows.get(name).durationMs, jobs: [...parent.jobs, name] })
      pending.delete(name)
      progressed = true
    }
    if (!progressed) {
      throw new Error('CI topology contains a dependency cycle')
    }
  }
  return [...paths.values()].reduce((best, value) => value.durationMs > best.durationMs ? value : best, { durationMs: 0, jobs: [] })
}

/** 审批后墙钟覆盖排队与执行，另保留审批等待、累计调度等待和纯执行关键路径。 */
export function ciRunMetrics(run, jobs, deploymentStatuses, needs) {
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('CI benchmark run is not successful and complete')
  }
  const gate = jobs.filter(job => job.name === 'Approve PR checks')
  if (gate.length !== 1) {
    throw new Error('CI approval job is missing or duplicated')
  }
  const statuses = deploymentStatuses.filter(status => status.log_url?.endsWith(`/job/${gate[0].id}`))
  const waiting = statuses.filter(status => status.state === 'waiting')
  const queued = statuses.filter(status => status.state === 'queued')
  if (waiting.length !== 1 || queued.length !== 1) {
    throw new Error('CI approval timing requires one matching waiting and queued deployment status')
  }
  const approvalWaitMs = timestamp(queued[0].created_at) - timestamp(waiting[0].created_at)
  if (approvalWaitMs < 0) {
    throw new Error('CI approval timestamps are reversed')
  }
  const criticalPath = ciCriticalPath(jobs, needs)
  const executed = jobs.filter(job => job.conclusion !== 'skipped')
  const approvalToCompletionMs = Math.max(...executed.map(job => timestamp(job.completed_at))) - timestamp(queued[0].created_at)
  if (approvalToCompletionMs <= 0) {
    throw new Error('CI approval-to-completion interval must be positive')
  }
  const durations = executed.map(job => timestamp(job.completed_at) - timestamp(job.started_at))
  const queues = executed.map(job => timestamp(job.started_at) - Math.max(timestamp(job.created_at), job.id === gate[0].id ? timestamp(queued[0].created_at) : 0))
  if ([...durations, ...queues].some(value => value < 0)) {
    throw new Error('CI timing has a negative interval')
  }
  return {
    approvalWaitMs,
    approvalToCompletionMs,
    schedulingWaitMs: queues.reduce((sum, value) => sum + value, 0),
    executionMs: criticalPath.durationMs,
    runnerMs: durations.reduce((sum, value) => sum + value, 0),
    criticalPath: criticalPath.jobs,
    schedulingWaitDefinition: 'sum of job runner queue intervals; approval excluded',
  }
}

/** 只读采集 job 与 deployment 原始时间；不修改审批，也不启动任何验证。 */
export async function collectCiEvidence(repository, runId, configuration, execute = execa) {
  validateCiConfiguration(configuration, repository, runId)
  return withCiRun(repository, runId, execute, async ({ run, jobs, allArtifacts, get, paged, download, downloads }) => {
    validateCiRun(run, configuration.identity)
    const deployments = await paged(`repos/${repository}/deployments?environment=pr-ci-approval&sha=${run.head_sha}`)
    const deploymentStatuses = (await Promise.all(deployments.map(deployment => paged(`repos/${repository}/deployments/${deployment.id}/statuses`)))).flat()
    const metrics = ciRunMetrics(run, jobs, deploymentStatuses, configuration)
    const contextArtifact = await download('pr-context')
    const { context, sourceFingerprint } = await validateCiContext(contextArtifact.directory, run, configuration.identity, get)
    const workload = await readCiWorkload(context, get)
    const contract = configuration.contract ? await readCiContract(configuration.contract, context, get, configuration) : null
    const execution = contract ? await readExecutionEvidence(contract.value, context, download, configuration) : { complete: false, reason: 'Missing immutable benchmark contract' }
    const evidence = { run, jobs, deploymentStatuses, context, workload, artifactInventory: allArtifacts, artifacts: [...downloads.values()].map(value => value.artifact), contract: contract?.receipt ?? null, execution }
    const sample = execution.complete
      ? validateSample({
          schemaVersion: 1,
          id: configuration.cohort.id,
          variant: configuration.cohort.variant,
          measurement: 'ci',
          ...contract.comparison,
          revision: context.checkoutSha,
          sourceFingerprint,
          inputDigest: contract.inputDigest,
          scopeDigest: evidenceDigest({ workload, execution: execution.scopeDigest }),
          profile: execution.profile,
          complete: true,
          outcome: 'passed',
          metrics,
          evidence,
        })
      : null
    return { schemaVersion: 1, metrics, evidence, sample, incompleteReason: sample ? null : execution.reason }
  })
}
