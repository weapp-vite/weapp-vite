import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { extractArtifactArchive, validateCurrentAttemptJobs } from '../../../.github/scripts/verification-artifacts.mjs'
import { currentAttemptArtifacts, validateArtifact } from './identity.mjs'

/** 只读会话统一拥有下载目录；完整运行及当前 attempt 的 artifact 才能进入采集。 */
export async function withCiRun(repository, runId, execute, operation) {
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository) || !/^\d+$/u.test(String(runId))) {
    throw new Error('Invalid GitHub run identity')
  }
  const get = async endpoint => JSON.parse((await execute('gh', ['api', endpoint])).stdout)
  const paged = async (endpoint, field) => {
    const all = []
    for (let page = 1; ; page++) {
      const value = await get(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
      const rows = field ? value[field] : value
      if (!Array.isArray(rows)) {
        throw new TypeError('Invalid GitHub paginated response')
      }
      all.push(...rows)
      if (rows.length < 100) {
        return all
      }
    }
  }
  const run = await get(`repos/${repository}/actions/runs/${runId}`)
  if (String(run.id) !== String(runId) || run.repository?.full_name !== repository || run.event !== 'pull_request'
    || run.path !== '.github/workflows/ci-pr.yml' || run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('Invalid native CI run identity or status')
  }
  const [jobs, artifacts] = await Promise.all([
    paged(`repos/${repository}/actions/runs/${runId}/attempts/${run.run_attempt}/jobs`, 'jobs'),
    paged(`repos/${repository}/actions/runs/${runId}/artifacts`, 'artifacts'),
  ])
  if (new Set(artifacts.map(artifact => artifact.id)).size !== artifacts.length) {
    throw new Error('Duplicated CI artifact listing')
  }
  const currentArtifacts = currentAttemptArtifacts(artifacts, run)
  validateCurrentAttemptJobs(jobs, run)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'verification-ci-'))
  const downloads = new Map()
  const pending = new Map()
  let closing = false
  let failure
  let result
  try {
    const download = async (name) => {
      if (closing) {
        throw new Error('CI artifact session is closing')
      }
      if (!pending.has(name)) {
        pending.set(name, (async () => {
          const artifact = validateArtifact(artifacts, name, run)
          const target = path.join(directory, String(artifact.id))
          const archive = path.join(directory, `${artifact.id}.zip`)
          await execute('gh', ['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`], { stdout: { file: archive }, buffer: false })
          await extractArtifactArchive(archive, target, artifact)
          const value = { directory: target, artifact }
          downloads.set(name, value)
          return value
        })())
      }
      return pending.get(name)
    }
    result = await operation({ run, jobs, artifacts: currentArtifacts, allArtifacts: artifacts, get, paged, download, downloads })
    const latest = await get(`repos/${repository}/actions/runs/${runId}`)
    if (['id', 'run_attempt', 'event', 'path', 'head_sha', 'run_started_at', 'updated_at', 'status', 'conclusion'].some(key => run[key] !== latest[key])) {
      throw new Error('CI run changed during evidence collection')
    }
  }
  catch (error) {
    failure = error
  }
  finally {
    closing = true
    await Promise.allSettled(pending.values())
    try {
      await rm(directory, { recursive: true, force: true })
    }
    catch (error) {
      failure = failure ? new AggregateError([failure, error], 'CI collection and temporary resource cleanup failed') : error
    }
  }
  if (failure) {
    throw failure
  }
  return result
}
