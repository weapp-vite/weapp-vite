import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { expect } from 'vitest'

export const time = seconds => new Date(Date.UTC(2026, 9, 19, 0, 0, seconds)).toISOString()
const job = (id, name, created, start, end) => ({ id, run_id: 123, run_attempt: 1, name, status: 'completed', conclusion: 'success', created_at: time(created), started_at: time(start), completed_at: time(end) })
export const jobs = [job(1, 'Approve PR checks', 0, 10, 11), job(2, 'build', 11, 12, 16), job(3, 'tests', 16, 18, 24), job(4, 'lint', 11, 13, 20)]
export const needs = { 'Approve PR checks': [], 'build': ['Approve PR checks'], 'tests': ['build'], 'lint': ['Approve PR checks'] }
export const statuses = [{ state: 'waiting', created_at: time(1), log_url: 'https://example.test/job/1' }, { state: 'queued', created_at: time(8), log_url: 'https://example.test/job/1' }]

export function fixture() {
  const repository = 'example/framework'
  const headSha = 'a'.repeat(40)
  const baseSha = 'b'.repeat(40)
  const checkoutSha = 'c'.repeat(40)
  const treeSha = 'd'.repeat(40)
  const run = {
    id: 123,
    run_attempt: 1,
    status: 'completed',
    conclusion: 'success',
    event: 'pull_request',
    path: '.github/workflows/ci-pr.yml',
    head_sha: headSha,
    head_branch: 'candidate',
    repository: { id: 7, full_name: repository },
    head_repository: { id: 7, full_name: repository },
    run_started_at: time(0),
    updated_at: time(30),
    pull_requests: [{ number: 42, head: { sha: headSha, ref: 'candidate' }, base: { sha: baseSha, ref: 'main' } }],
  }
  const identity = { repository, prNumber: 42, runId: 123, runAttempt: 1, event: 'pull_request', workflow: run.path, headSha, baseSha, driverSha: checkoutSha, checkoutSha, checkoutMode: 'merge' }
  const context = { schemaVersion: 1, ...identity, isPr: true, headRepository: repository, headRef: 'candidate', baseRef: 'main', selections: { ci: true } }
  delete context.workflow
  const workload = { schemaVersion: 1, draft: false, id: 'ci-test-v1', pullRequests: [42], baseBranch: 'main', profiles: ['ci'] }
  const workloadSource = JSON.stringify(workload)
  const blobHash = source => createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0${source}`).digest('hex')
  context.pathSelections = { ci: true }
  context.selectionSources = { ci: 'path+workload' }
  context.benchmarkWorkload = { schemaVersion: 1, id: workload.id, baseBranch: 'main', profiles: ['ci'], manifest: { path: '.github/verification-workload.json', blobSha: blobHash(workloadSource), sha256: createHash('sha256').update(workloadSource).digest('hex') } }
  const coverageIdentity = { commit: checkoutSha, nodeMajor: '24', nodeVersion: 'v24.18.0', packageManager: 'pnpm@11.0.0', os: 'linux', arch: 'x64', configHash: 'e'.repeat(64) }
  const inventory = [{ projectName: 'framework', file: 'packages/framework/test.ts' }]
  const data = { schemaVersion: 1, identity: coverageIdentity, shards: 1, inventory }
  const hash = value => createHash('sha256').update(value).digest('hex')
  const plan = { ...data, planHash: hash(JSON.stringify(data)) }
  const blob = JSON.stringify({ actualVitestBlob: true })
  const shard = { schemaVersion: 1, identity: coverageIdentity, index: 1, status: 'passed', inventory, durationMs: 1000, planHash: plan.planHash, blobHash: hash(blob) }
  const verdict = { schemaVersion: 1, status: 'passed', shards: 1, tests: 1, planHash: plan.planHash }
  const contract = {
    schemaVersion: 1,
    workload: structuredClone(context.benchmarkWorkload),
    inputFiles: ['packages/framework/src/index.ts'],
    needs,
    outOfScope: {},
    profile: { os: 'linux', node: '24', provider: 'headless', platform: 'weapp', runnerClass: 'github-hosted', cachePolicy: 'warm' },
    evidence: [{
      id: 'unit',
      kind: 'coverage',
      profile: { os: 'linux', nodeMajor: '24', nodeVersion: 'v24.18.0', packageManager: 'pnpm@11.0.0', arch: 'x64' },
      plan: { artifact: 'coverage-plan', file: 'plan.json' },
      shards: [{ artifact: 'coverage-shard-1', file: 'manifest.json', blob: 'blob.json' }],
      verdict: { artifact: 'coverage-complete', file: 'shard-verdict.json' },
      scope: inventory,
    }],
  }
  const files = {
    'pr-context': { 'context.json': context },
    'coverage-plan': { 'plan.json': plan },
    'coverage-shard-1': { 'manifest.json': shard, 'blob.json': blob },
    'coverage-complete': { 'shard-verdict.json': verdict },
  }
  const artifacts = Object.keys(files).map((name, index) => ({
    id: index + 10,
    name,
    expired: false,
    created_at: time(20),
    workflow_run: { id: run.id, repository_id: 7, head_repository_id: 7, head_sha: headSha, head_branch: run.head_branch },
  }))
  const contractPath = '.github/benchmark.json'
  const configuration = { schemaVersion: 1, identity, cohort: { id: 'baseline-1', variant: 'baseline' }, contract: contractPath, needs, outOfScope: {} }
  const downloads = []
  const immutableFiles = {
    '.github/verification-workload.json': workloadSource,
    '.github/pr-checks.json': JSON.stringify({ ci: { paths: [], baseBranches: [], checkoutMode: 'merge' } }),
  }
  const actualJobs = structuredClone(jobs)
  const archives = new Map()
  const commit = { sha: checkoutSha, tree: { sha: treeSha }, parents: [{ sha: baseSha }, { sha: headSha }] }
  const execute = async (command, args, options) => {
    expect(command).toBe('gh')
    const zipMatch = /\/actions\/artifacts\/(\d+)\/zip$/u.exec(args[1])
    if (zipMatch) {
      expect(args[0]).toBe('api')
      expect(options.buffer).toBe(false)
      const filename = options.stdout.file
      downloads.push(filename)
      await writeFile(filename, archives.get(Number(zipMatch[1])))
      return { stdout: '' }
    }
    expect(args[0]).toBe('api')
    const prefix = `repos/${repository}`
    const endpoint = args[1]
    let response
    if (endpoint === `${prefix}/actions/runs/123`) {
      response = run
    }
    else if (endpoint.includes('/jobs?')) {
      response = { jobs: actualJobs }
    }
    else if (endpoint.includes('/artifacts?')) {
      for (const artifact of artifacts) {
        const zip = new AdmZip()
        for (const [file, value] of Object.entries(files[artifact.name] ?? {})) {
          zip.addFile(file, Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)))
        }
        const bytes = zip.toBuffer()
        archives.set(artifact.id, bytes)
        artifact.size_in_bytes = bytes.length
        artifact.digest = `sha256:${hash(bytes)}`
      }
      response = { artifacts }
    }
    else if (endpoint.includes('/statuses?')) {
      response = statuses
    }
    else if (endpoint.includes('/deployments?')) {
      response = [{ id: 1 }]
    }
    else if (endpoint === `${prefix}/git/commits/${checkoutSha}`) {
      response = commit
    }
    else {
      const entries = [[contractPath, JSON.stringify(contract)], [contract.inputFiles[0], 'export const value = 1'], ...Object.entries(immutableFiles)].map(([file, content]) => {
        const sha = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0${content}`).digest('hex')
        return { path: file, sha, content, type: 'blob', mode: '100644' }
      })
      response = endpoint.includes('/trees/') ? { sha: treeSha, truncated: false, tree: entries } : { ...entries.find(entry => endpoint.endsWith(entry.sha)), encoding: 'base64' }
      if (response.content) {
        response.content = Buffer.from(response.content).toString('base64')
      }
    }
    return { stdout: JSON.stringify(response) }
  }
  return { repository, configuration, execute, run, context, artifacts, contract, files, downloads, commit, immutableFiles, jobs: actualJobs, archives }
}
