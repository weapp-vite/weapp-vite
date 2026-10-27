import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 精确 artifact ID 下载历史报告，兼容 Windows 的 gh 启动器。
import { execa } from 'execa'
import { currentAttemptArtifacts, extractArtifactArchive, validateCurrentAttemptJobs } from './verification-artifacts.mjs'

/** 仅接受默认分支成功运行；报告内容不能自行宣称来源可信。 */
export function trustedHistoryRun(run, repository, defaultBranch) {
  return run.status === 'completed' && run.conclusion === 'success' && run.path === '.github/workflows/ci-e2e.yml'
    && ['push', 'schedule', 'workflow_dispatch'].includes(run.event)
    && run.head_branch === defaultBranch && run.head_repository?.full_name === repository && run.repository?.full_name === repository
    && /^[a-f\d]{40}$/u.test(run.head_sha) && [run.id, run.run_attempt, run.repository?.id, run.head_repository?.id].every(value => Number.isSafeInteger(value) && value > 0)
}

/** 最近三十天最多十轮完整执行，为下游中位数提供足够样本。 */
export async function downloadVerificationHistory({ repository, defaultBranch, os, nodeMajor, output, token, api = 'https://api.github.com', now = Date.now() }, request = fetch, execute = execa) {
  assert(/^[\w.-]+\/[\w.-]+$/u.test(repository) && typeof defaultBranch === 'string' && defaultBranch, 'Invalid history repository or branch')
  assert(Number.isFinite(now), 'Invalid history collection time')
  const oldest = now - 30 * 86_400_000
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  const get = async (resource) => {
    const response = await request(`${api}/repos/${repository}${resource}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    })
    assert(response.ok, `History API returned ${response.status}`)
    return response.json()
  }
  const page = async (endpoint, field, index) => {
    const value = await get(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${index}`)
    assert(Number.isSafeInteger(value.total_count) && value.total_count >= 0 && Array.isArray(value[field]), 'Incomplete history paginated listing')
    return value
  }
  const paged = async (endpoint, field) => {
    const first = await page(endpoint, field, 1)
    const rows = [...first[field]]
    for (let index = 2; rows.length < first.total_count; index++) {
      const value = await page(endpoint, field, index)
      assert(value.total_count === first.total_count && value[field].length > 0, 'Incomplete history paginated listing')
      rows.push(...value[field])
    }
    assert(rows.length === first.total_count && new Set(rows.map(row => row.id)).size === rows.length, 'Duplicated or incomplete history listing')
    return rows
  }
  const runIds = []
  let artifactCount = 0
  const seen = new Set()
  const endpoint = `/actions/workflows/ci-e2e.yml/runs?branch=${encodeURIComponent(defaultBranch)}&status=success&created=${encodeURIComponent(`>=${new Date(oldest).toISOString()}`)}`
  for (let index = 1; runIds.length < 10; index++) {
    const listing = await page(endpoint, 'workflow_runs', index)
    if (!listing.workflow_runs.length) {
      break
    }
    for (const run of listing.workflow_runs) {
      assert(!seen.has(run.id), 'Duplicated history run listing')
      seen.add(run.id)
      if (!trustedHistoryRun(run, repository, defaultBranch)
        || !Number.isFinite(Date.parse(run.run_started_at)) || Date.parse(run.run_started_at) < oldest
        || !Number.isFinite(Date.parse(run.updated_at)) || Date.parse(run.updated_at) > now || Date.parse(run.updated_at) < Date.parse(run.run_started_at)) {
        continue
      }
      const directory = path.join(output, String(run.id))
      try {
        const [allArtifacts, jobs] = await Promise.all([
          paged(`/actions/runs/${run.id}/artifacts`, 'artifacts'),
          paged(`/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs'),
        ])
        validateCurrentAttemptJobs(jobs, run)
        const names = [`miniapp-aggregate-${os}-node-${nodeMajor}-full`, `ide-dom-headless-aggregate-${os}-node-${nodeMajor}-full`]
        await mkdir(directory)
        let downloaded = 0
        for (const name of names) {
          const target = path.join(directory, name)
          let archive
          try {
            // 两种 provider 独立核验；一个缺失或损坏不能丢弃另一个可信样本。
            const matches = currentAttemptArtifacts(allArtifacts.filter(value => value.name === name), run)
            assert(matches.length === 1, 'Missing history provider artifact')
            const artifact = matches[0]
            archive = path.join(directory, `${artifact.id}.zip`)
            await execute('gh', ['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`], { env: { GH_TOKEN: token }, stdout: { file: archive }, buffer: false })
            await extractArtifactArchive(archive, target, artifact)
            downloaded++
          }
          catch {
            await rm(target, { recursive: true, force: true })
          }
          finally {
            if (archive) {
              await rm(archive, { force: true })
            }
          }
        }
        assert(downloaded > 0, 'No trusted provider history artifacts')
        const latest = await get(`/actions/runs/${run.id}`)
        assert(['id', 'run_attempt', 'head_sha', 'run_started_at', 'updated_at', 'status', 'conclusion'].every(key => latest[key] === run[key]), 'History run changed during download')
        await writeFile(path.join(directory, 'receipt.json'), `${JSON.stringify({ repository, workflow: run.path, runId: run.id, runAttempt: run.run_attempt, headSha: run.head_sha, headBranch: run.head_branch, defaultBranch, event: run.event, conclusion: run.conclusion, verified: true }, null, 2)}\n`)
        runIds.push(run.id)
        artifactCount += downloaded
      }
      catch {
        // 单轮缺失、旧 attempt 或损坏不能污染历史，也不妨碍其它可信轮次。
        await rm(directory, { recursive: true, force: true })
      }
      if (runIds.length === 10) {
        break
      }
    }
    if (seen.size >= listing.total_count) {
      break
    }
  }
  return { runIds, artifacts: artifactCount }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [output, os, nodeMajor] = process.argv.slice(2)
  try {
    const result = await downloadVerificationHistory({ repository: process.env.GITHUB_REPOSITORY, defaultBranch: process.env.VERIFICATION_DEFAULT_BRANCH, os, nodeMajor, output: path.resolve(output), token: process.env.GITHUB_TOKEN, api: process.env.GITHUB_API_URL })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
  catch {
    // 历史只影响分片均衡，无法取得时保留完整确定性验证范围；不回显请求或认证信息。
    process.stderr.write('Verification history unavailable; using deterministic task weights\n')
    await rm(path.resolve(output), { recursive: true, force: true })
    await mkdir(path.resolve(output), { recursive: true })
  }
}
