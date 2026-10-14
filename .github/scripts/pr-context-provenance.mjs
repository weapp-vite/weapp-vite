import { validatePrContext } from './pr-context.mjs'
import { downloadPrContext } from './resolve-performance-runs.mjs'

const checkout = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
const upload = 'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9'

function reject(message) {
  throw Object.assign(new Error(message), { code: 'PR_CONTEXT_UNTRUSTED' })
}

function positive(value) {
  return /^[1-9]\d*$/u.test(String(value))
}

function trustedDriver(run, repository, defaultBranch) {
  if (!positive(run.id) || !positive(run.run_attempt ?? 1) || !/^[a-f\d]{40}$/u.test(run.head_sha)
    || run.event !== 'workflow_dispatch' || run.head_branch !== defaultBranch
    || run.head_repository?.full_name !== repository) {
    reject('Artifact provenance requires a default-branch manual driver')
  }
}

function validArtifact(artifact, run, defaultBranch) {
  return positive(artifact.id) && artifact.name === 'pr-context' && artifact.expired === false
    && /^sha256:[a-f\d]{64}$/u.test(artifact.digest ?? '')
    && String(artifact.workflow_run?.id) === String(run.id)
    && artifact.workflow_run?.head_sha === run.head_sha && artifact.workflow_run?.head_branch === defaultBranch
    && (!run.repository?.id || artifact.workflow_run.repository_id === run.repository.id)
    && (!run.head_repository?.id || artifact.workflow_run.head_repository_id === run.head_repository.id)
}

function resolverJob(job, run) {
  const names = [`Run ${checkout}`, 'Run node .github/scripts/pr-context.mjs', `Run ${upload}`]
  const steps = names.map(name => job.steps?.filter(step => step.name === name) ?? [])
  return job.name === 'pr-context / resolve' && positive(job.id) && positive(job.run_attempt)
    && String(job.run_id) === String(run.id) && job.head_sha === run.head_sha
    && BigInt(job.run_attempt) <= BigInt(run.run_attempt ?? 1)
    && job.status === 'completed' && job.conclusion === 'success'
    && steps.every(matches => matches.length === 1 && matches[0].status === 'completed' && matches[0].conclusion === 'success')
    && steps[0][0].number < steps[1][0].number && steps[1][0].number < steps[2][0].number
}

function normalizedLines(log) {
  if (typeof log !== 'string' || log.length > 1_048_576) {
    reject('Invalid resolver job log')
  }
  return log.split(/\r?\n/u).map(line => line.replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z /u, ''))
}

function uploadedByDriver(log, artifact, run, repository, defaultBranch, serverUrl) {
  const lines = normalizedLines(log)
  const use = `Uses: ${repository}/.github/workflows/reusable-pr-context.yml@refs/heads/${defaultBranch} (${run.head_sha})`
  const checkoutStart = lines.indexOf(`##[group]Run ${checkout}`)
  const resolveStart = lines.indexOf('##[group]Run node .github/scripts/pr-context.mjs')
  const uploadStart = lines.indexOf(`##[group]Run ${upload}`)
  if (!lines.includes(use) || checkoutStart < 0 || resolveStart <= checkoutStart || uploadStart <= resolveStart) {
    return false
  }
  const checkoutLines = lines.slice(checkoutStart, resolveStart)
  const checkedOut = checkoutLines.findIndex(line => /^\[command\].*\bgit log -1 --format=%H$/u.test(line))
  const refs = checkoutLines.filter(line => line.startsWith('  ref: ')).map(line => line.slice('  ref: '.length))
  const checkoutSha = checkoutLines[checkedOut + 1]
  if (refs.length !== 1 || ![run.head_sha, defaultBranch].includes(refs[0])
    || !checkoutLines.includes(`  repository: ${repository}`) || checkedOut < 0
    || !/^[a-f\d]{40}$/u.test(checkoutSha)
    || (refs[0] === run.head_sha && checkoutSha !== run.head_sha)) {
    return false
  }
  const remaining = lines.slice(uploadStart + 1)
  const end = remaining.findIndex(line => line === 'Post job cleanup.' || line.startsWith('##[group]Run '))
  const output = end < 0 ? remaining : remaining.slice(0, end)
  const ids = output.flatMap((line) => {
    const match = /^Artifact pr-context (?:successfully finalized\. Artifact ID |has been successfully uploaded! Final size is \d+ bytes\. Artifact ID is )([1-9]\d*)$/u.exec(line)
    return match ? [match[1]] : []
  })
  const digest = artifact.digest.slice('sha256:'.length)
  const url = `${serverUrl.replace(/\/$/u, '')}/${repository}/actions/runs/${run.id}/artifacts/${artifact.id}`
  return ids.length >= 1 && ids.every(id => id === String(artifact.id))
    && output.includes(`SHA256 digest of uploaded artifact is ${digest}`)
    && output.includes(`Artifact download URL: ${url}`)
    && output.includes('  name: pr-context') && output.includes('  path: .tmp/pr-context/context.json')
}

/** 旧运行没有状态凭据时，只接受可信解析任务日志中固定 ID 与摘要的不可变 artifact。 */
export async function authenticatePrContextArtifact({ repository, run, artifact, defaultBranch, request, readJobLog, serverUrl = 'https://github.com' }) {
  trustedDriver(run, repository, defaultBranch)
  if (!validArtifact(artifact, run, defaultBranch)) {
    reject('PR context artifact does not belong to the trusted driver')
  }
  const jobs = []
  for (let page = 1; ; page++) {
    const response = await request(`/repos/${repository}/actions/runs/${run.id}/jobs?filter=all&per_page=100&page=${page}`)
    if (!Array.isArray(response.jobs)) {
      reject('Invalid workflow job listing')
    }
    jobs.push(...response.jobs)
    if (response.jobs.length < 100) {
      break
    }
  }
  const candidates = jobs.filter(job => resolverJob(job, run)).sort((a, b) => b.run_attempt - a.run_attempt)
  if (new Set(candidates.map(job => String(job.run_attempt))).size !== candidates.length) {
    reject('Ambiguous trusted resolver jobs')
  }
  const readLog = readJobLog ?? (pathname => request(pathname, { responseType: 'text' }))
  for (const job of candidates) {
    const log = await readLog(`/repos/${repository}/actions/jobs/${job.id}/logs`)
    if (uploadedByDriver(log, artifact, run, repository, defaultBranch, serverUrl)) {
      return { artifact, runAttempt: Number(job.run_attempt), jobId: job.id }
    }
  }
  reject('PR context artifact has no authenticated resolver upload')
}

/** 按上传来源读取历史上下文，避免同名 artifact 被候选提交替换后用于补写成功状态。 */
export async function readVerifiedPrContext({ apiUrl, token, repository, run, defaultBranch, request, readJobLog, download = downloadPrContext, serverUrl = 'https://github.com' }) {
  trustedDriver(run, repository, defaultBranch)
  const response = await request(`/repos/${repository}/actions/runs/${run.id}/artifacts?name=pr-context&per_page=100`)
  if (!Array.isArray(response.artifacts) || response.total_count > 100) {
    reject('Invalid or truncated PR context artifact listing')
  }
  const artifacts = response.artifacts.filter(artifact => artifact.name === 'pr-context' && !artifact.expired)
  if (!artifacts.length) {
    throw Object.assign(new Error('Manual PR context artifact is not available'), { code: 'PR_CONTEXT_MISSING' })
  }
  if (artifacts.length !== 1) {
    reject('Ambiguous PR context artifacts')
  }
  const provenance = await authenticatePrContextArtifact({ repository, run, artifact: artifacts[0], defaultBranch, request, readJobLog, serverUrl })
  const context = await download({ apiUrl, token, repository, run, artifact: provenance.artifact, request: (_url, _token, pathname) => request(pathname) })
  try {
    validatePrContext(context, run, repository)
  }
  catch {
    reject('Authenticated artifact contains invalid PR context identity')
  }
  if (Number(context.runAttempt ?? 1) !== provenance.runAttempt) {
    reject('Context attempt does not match its authenticated resolver upload')
  }
  return context
}
