import assert from 'node:assert/strict'
import { appendFile, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- gh 启动需要跨平台命令解析。
import { execa } from 'execa'
import { confirmPreview } from './confirm.ts'
import { archiveIntegrity, previewVersion, readPreviewManifest, record, sourceSha } from './contract.ts'

export function recoveryRun(value: unknown, repository: string, branch: string, id: string) {
  const run = record(value)
  assert.equal(String(run.id), id, 'Recovery run id differs')
  assert.equal(record(run.repository).full_name, repository)
  assert.equal(record(run.head_repository).full_name, repository, 'Recovery cannot use a fork')
  assert.equal(run.head_branch, branch, 'Recovery requires the default branch')
  assert.equal(run.path, '.github/workflows/wxml-preview.yml')
  assert.equal(run.event, 'workflow_dispatch')
  assert.equal(run.status, 'completed', 'Wait for the original publication to finish')
  assert.ok(typeof run.run_attempt === 'number' && Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0)
  return { sha: sourceSha(run.head_sha), attempt: run.run_attempt }
}

/** 复用原运行的冻结产物，验证后置失败的版本；不构建、改版本或再次发布。 */
export async function recoverPreview(env: NodeJS.ProcessEnv = process.env) {
  const id = env.PREVIEW_VERIFY_RUN_ID
  assert.ok(id && /^[1-9]\d{0,15}$/.test(id), 'Recovery requires an explicit numeric run id')
  assert.equal(env.GITHUB_REPOSITORY, 'weapp-vite/weapp-vite')
  assert.ok(env.DEFAULT_BRANCH && env.GITHUB_REF === `refs/heads/${env.DEFAULT_BRANCH}`)
  assert.ok(env.RUNNER_TEMP && path.isAbsolute(env.RUNNER_TEMP))
  const version = previewVersion(env.PREVIEW_VERSION)
  const verifierSha = sourceSha(env.GITHUB_SHA)
  const repository = env.GITHUB_REPOSITORY
  const api = async (endpoint: string, paginate = false): Promise<unknown> => {
    const { stdout } = await execa('gh', ['api', ...(paginate ? ['--paginate', '--slurp'] : []), `repos/${repository}/actions/runs/${id}${endpoint ? `/${endpoint}` : ''}`], { env })
    return JSON.parse(stdout) as unknown
  }
  const run = recoveryRun(await api(''), repository, env.DEFAULT_BRANCH, id)
  const jobPages = await api(`attempts/${run.attempt}/jobs?per_page=100`, true)
  assert.ok(Array.isArray(jobPages))
  const jobs = jobPages.flatMap((page) => {
    const entries = record(page).jobs
    assert.ok(Array.isArray(entries))
    return entries.map(record)
  })
  const publishers = jobs.filter(job => job.name === 'Check and publish WXML alpha')
  assert.equal(publishers.length, 1, 'Recovery requires the original publisher job')
  const steps = publishers[0]!.steps
  assert.ok(Array.isArray(steps) && steps.some((step) => {
    const item = record(step)
    return item.name === 'Publish using npm OIDC' && item.conclusion === 'success'
  }), 'Original npm OIDC upload must have succeeded')
  const artifactName = `wxml-preview-${id}-${run.attempt}`
  const artifactPages = await api('artifacts?per_page=100', true)
  assert.ok(Array.isArray(artifactPages))
  const artifacts = artifactPages.flatMap((page) => {
    const entries = record(page).artifacts
    assert.ok(Array.isArray(entries))
    return entries.map(record)
  }).filter(artifact => artifact.name === artifactName && artifact.expired === false)
  assert.equal(artifacts.length, 1, 'Recovery requires one unexpired original artifact')
  const directory = path.join(env.RUNNER_TEMP, 'wxml-preview')
  await mkdir(directory)
  await execa('gh', ['run', 'download', id, '--repo', repository, '--name', artifactName, '--dir', directory], { env })
  if ((await readdir(directory)).includes('confirmed.json')) {
    await rename(path.join(directory, 'confirmed.json'), path.join(directory, 'original-confirmed.json'))
  }
  const filename = path.join(directory, 'manifest.json')
  const manifest = readPreviewManifest(JSON.parse(await readFile(filename, 'utf8')) as unknown)
  assert.equal(manifest.sourceSha, run.sha, 'Artifact source differs from the original CI run')
  assert.equal(manifest.version, version)
  const archiveName = `weapp-vite-wxml-${version}.tgz`
  assert.equal(path.posix.basename(manifest.tarball), archiveName)
  const tarball = path.join(directory, archiveName)
  assert.equal(archiveIntegrity(await readFile(tarball)), manifest.integrity, 'Recovered archive differs from the original manifest')
  await writeFile(path.join(directory, 'original-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  await writeFile(filename, `${JSON.stringify({ ...manifest, tarball }, null, 2)}\n`)
  const recovery = { originalRunId: id, originalAttempt: run.attempt, originalSourceSha: run.sha, verifierSha, version, artifactName }
  await writeFile(path.join(directory, 'recovery.json'), `${JSON.stringify(recovery, null, 2)}\n`, { flag: 'wx' })
  if (env.GITHUB_STEP_SUMMARY) {
    await appendFile(env.GITHUB_STEP_SUMMARY, `验证既有上传：[原 CI 运行](https://github.com/${repository}/actions/runs/${id})；原提交 \`${run.sha}\`；验证器提交 \`${verifierSha}\`。本轮不重新发布。\n\n`)
  }
  return confirmPreview({ manifest: filename, env: { ...env, GITHUB_SHA: run.sha } })
}
