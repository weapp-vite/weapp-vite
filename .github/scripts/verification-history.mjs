import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 按 API 核验的 artifact 名下载历史报告，兼容 Windows 的 gh 启动器。
import { execa } from 'execa'

/** 仅接受默认分支成功运行；报告内容不能自行宣称来源可信。 */
export function trustedHistoryRun(run, repository, defaultBranch) {
  return run.status === 'completed' && run.conclusion === 'success' && run.path === '.github/workflows/ci-e2e.yml'
    && ['push', 'schedule', 'workflow_dispatch'].includes(run.event)
    && run.head_branch === defaultBranch && run.head_repository?.full_name === repository
    && /^[a-f\d]{40}$/u.test(run.head_sha) && Number.isSafeInteger(run.id) && run.id > 0 && Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0
}

export async function downloadVerificationHistory({ repository, defaultBranch, os, nodeMajor, output, token, api = 'https://api.github.com' }, request = fetch, execute = execa) {
  assert(/^[\w.-]+\/[\w.-]+$/u.test(repository), 'Invalid history repository')
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  const get = async (resource) => {
    const response = await request(`${api}/repos/${repository}${resource}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      throw new Error(`History API returned ${response.status}`)
    }
    return response.json()
  }
  const runs = await get(`/actions/workflows/ci-e2e.yml/runs?branch=${encodeURIComponent(defaultBranch)}&status=success&per_page=10`)
  for (const run of runs.workflow_runs ?? []) {
    if (!trustedHistoryRun(run, repository, defaultBranch)) {
      continue
    }
    let listing = await get(`/actions/runs/${run.id}/artifacts?per_page=100&page=1`)
    assert(Number.isSafeInteger(listing.total_count) && listing.total_count >= 0, 'Incomplete history artifact listing')
    const allArtifacts = [...listing.artifacts]
    for (let page = 2; allArtifacts.length < listing.total_count; page++) {
      listing = await get(`/actions/runs/${run.id}/artifacts?per_page=100&page=${page}`)
      assert(listing.artifacts.length > 0, 'Incomplete history artifact listing')
      allArtifacts.push(...listing.artifacts)
    }
    assert.equal(new Set(allArtifacts.map(artifact => artifact.id)).size, allArtifacts.length, 'Duplicated history artifacts')
    const name = `miniapp-aggregate-${os}-node-${nodeMajor}-full`
    const artifacts = allArtifacts.filter(artifact => artifact.name === name && !artifact.expired
      && artifact.workflow_run?.id === run.id && artifact.workflow_run?.head_sha === run.head_sha)
    if (artifacts.length !== 1) {
      continue
    }
    const directory = path.join(output, String(run.id))
    await mkdir(directory, { recursive: true })
    for (const artifact of artifacts) {
      await execute('gh', ['run', 'download', String(run.id), '--repo', repository, '--name', artifact.name, '--dir', path.join(directory, artifact.name)], { env: { GH_TOKEN: token }, stdio: 'inherit' })
    }
    await writeFile(path.join(directory, 'receipt.json'), `${JSON.stringify({ repository, workflow: '.github/workflows/ci-e2e.yml', runId: run.id, runAttempt: run.run_attempt, headSha: run.head_sha, headBranch: run.head_branch, defaultBranch, event: run.event, conclusion: run.conclusion, verified: true }, null, 2)}\n`)
    return { runId: run.id, artifacts: artifacts.length }
  }
  return { runId: null, artifacts: 0 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [output, os, nodeMajor] = process.argv.slice(2)
  try {
    const result = await downloadVerificationHistory({ repository: process.env.GITHUB_REPOSITORY, defaultBranch: process.env.VERIFICATION_DEFAULT_BRANCH, os, nodeMajor, output: path.resolve(output), token: process.env.GITHUB_TOKEN, api: process.env.GITHUB_API_URL })
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
  catch (error) {
    // 历史只影响分片均衡，无法取得时保留完整确定性验证范围。
    process.stderr.write(`Verification history unavailable: ${error.message}\n`)
    await rm(path.resolve(output), { recursive: true, force: true })
    await mkdir(path.resolve(output), { recursive: true })
  }
}
