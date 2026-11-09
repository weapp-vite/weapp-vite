import assert from 'node:assert/strict'

const positive = value => Number.isSafeInteger(value) && value > 0

function sourceRunMatches(run, context) {
  const owned = run.referenced_workflows?.filter(item => item.path?.startsWith(`${context.repository}/`)) ?? []
  const merge = owned[0]?.sha
  return positive(run.id) && positive(run.run_attempt) && run.event === 'pull_request'
    && run.path === '.github/workflows/ci-pr.yml'
    && run.repository?.id === context.baseRepositoryId && run.repository.full_name === context.repository
    && run.head_repository?.id === context.headRepositoryId && run.head_repository.full_name === context.headRepository
    && run.head_sha === context.headSha && run.head_branch === context.headRef
    && /^[a-f\d]{40}$/u.test(merge ?? '') && owned.length > 0
    && owned.every(item => item.path.startsWith(`${context.repository}/.github/workflows/`)
      && item.path.endsWith(`@${merge}`) && item.sha === merge && item.ref === `refs/pull/${context.prNumber}/merge`)
    && Array.isArray(run.pull_requests) && (run.pull_requests.length === 0
      || run.pull_requests.some(pull => pull.number === context.prNumber && pull.head?.sha === context.headSha
        && pull.head.ref === context.headRef && pull.base?.ref === context.baseRef))
}

async function releasedToJobs(run, context, get) {
  for (let page = 1; ; page++) {
    const response = await get(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100&page=${page}`)
    assert(Array.isArray(response.jobs), 'Invalid fork source job response')
    if (response.jobs.some(job => job.name === 'Approve PR checks' && job.head_sha === context.headSha
      && job.run_id === run.id && job.run_attempt === run.run_attempt
      && ['waiting', 'queued', 'in_progress', 'completed'].includes(job.status))) {
      return true
    }
    if (response.jobs.length < 100) {
      return false
    }
  }
}

/** 外部 PR 必须先由 GitHub 原生审核释放工作流；仅证明该层放行，不继承旧 Environment 批准。 */
export async function verifyNativeRefreshForkAdmission(context, get) {
  if (context.headRepositoryId === context.baseRepositoryId) {
    return
  }
  if (context.forkSourceRunId !== undefined) {
    const run = await get(`/actions/runs/${context.forkSourceRunId}`)
    assert(sourceRunMatches(run, context) && await releasedToJobs(run, context, get), 'Native refresh fork source has not passed GitHub workflow approval')
    return
  }
  for (let page = 1; page <= 10; page++) {
    const response = await get(`/actions/workflows/ci-pr.yml/runs?event=pull_request&head_sha=${context.headSha}&per_page=100&page=${page}`)
    assert(Array.isArray(response.workflow_runs), 'Invalid fork source run response')
    for (const run of response.workflow_runs) {
      if (sourceRunMatches(run, context) && await releasedToJobs(run, context, get)) {
        context.forkSourceRunId = run.id
        return
      }
    }
    if (response.workflow_runs.length < 100) {
      break
    }
  }
  throw new Error('Native refresh fork source has not passed GitHub workflow approval')
}
