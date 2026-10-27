import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { expect, it, vi } from 'vitest'
import { downloadVerificationHistory, trustedHistoryRun } from '../.github/scripts/verification-history.mjs'
import { aggregateVerificationReports } from '../e2e/scripts/verification/aggregate'
import { collectDurationHistory } from '../e2e/scripts/verification/history'
import { freeze, profile, shardReports } from './verificationE2E/fixtures'

const repository = 'example/project'
const now = Date.parse('2026-10-19T01:00:00Z')
const name = 'miniapp-aggregate-ubuntu-latest-node-22-full'
const at = days => new Date(now - days * 86_400_000).toISOString()
const run = { id: 42, run_attempt: 2, status: 'completed', conclusion: 'success', event: 'push', path: '.github/workflows/ci-e2e.yml', head_branch: 'main', repository: { id: 7, full_name: repository }, head_repository: { id: 7, full_name: repository }, head_sha: 'a'.repeat(40), run_started_at: at(1), updated_at: at(0) }

function fixture(runs = [structuredClone(run)], contents = { 'report.json': { passed: true } }) {
  const archives = new Map()
  const artifacts = new Map(runs.map((record) => {
    const zip = new AdmZip()
    for (const [filename, content] of Object.entries(contents)) {
      zip.addFile(filename, Buffer.from(JSON.stringify(content)))
    }
    const bytes = zip.toBuffer()
    const artifact = { id: record.id * 10, name, expired: false, created_at: record.updated_at, size_in_bytes: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`, workflow_run: { id: record.id, head_sha: record.head_sha, head_branch: record.head_branch, repository_id: 7, head_repository_id: 7 } }
    archives.set(artifact.id, bytes)
    return [record.id, [artifact]]
  }))
  const jobs = new Map(runs.map(record => [record.id, [{ id: record.id * 100, run_id: record.id, run_attempt: record.run_attempt, status: 'completed', conclusion: 'success', started_at: record.run_started_at, completed_at: record.updated_at }]]))
  const runPages = [runs]
  const request = vi.fn(async (url) => {
    const parsed = new URL(url)
    const page = Number(parsed.searchParams.get('page'))
    let value
    if (parsed.pathname.endsWith('/runs')) {
      value = { total_count: runPages.flat().length, workflow_runs: runPages[page - 1] ?? [] }
    }
    else {
      const id = Number(/\/runs\/(\d+)/u.exec(parsed.pathname)[1])
      value = parsed.pathname.endsWith('/artifacts')
        ? { total_count: artifacts.get(id).length, artifacts: artifacts.get(id) }
        : parsed.pathname.endsWith('/jobs')
          ? { total_count: jobs.get(id).length, jobs: jobs.get(id) }
          : runs.find(record => record.id === id)
    }
    return { ok: true, json: async () => value }
  })
  const execute = vi.fn(async (command, args, options) => {
    expect(command).toBe('gh')
    expect(args[0]).toBe('api')
    expect(options.buffer).toBe(false)
    const id = Number(/\/artifacts\/(\d+)\/zip$/u.exec(args[1])[1])
    await writeFile(options.stdout.file, archives.get(id))
  })
  return { runs, artifacts, archives, jobs, runPages, request, execute }
}

async function collect(value, check) {
  const output = await mkdtemp(path.join(os.tmpdir(), 'verification-history-'))
  try {
    const result = await downloadVerificationHistory({ repository, defaultBranch: 'main', os: 'ubuntu-latest', nodeMajor: '22', output, token: 'test-token', now }, value.request, value.execute)
    await check(result, output)
  }
  finally {
    await rm(output, { recursive: true, force: true })
  }
}

it('accepts only independently verified complete default-branch workflow runs', () => {
  expect(trustedHistoryRun(run, repository, 'main')).toBe(true)
  for (const mutation of [{ event: 'pull_request' }, { head_branch: 'feature' }, { path: 'another.yml' }, { conclusion: 'failure' }, { status: 'in_progress' }, { run_attempt: 0 }, { repository: {} }, { head_repository: { full_name: 'other/project' } }]) {
    expect(trustedHistoryRun({ ...run, ...mutation }, repository, 'main')).toBe(false)
  }
})

it('downloads the current same-name aggregate by exact ID and writes an API-derived receipt', async () => {
  const value = fixture()
  value.artifacts.get(42).unshift({ ...value.artifacts.get(42)[0], id: 99, created_at: at(2), expired: true })
  await collect(value, async (result, output) => {
    expect(result).toEqual({ runIds: [42], artifacts: 1 })
    expect(value.execute).toHaveBeenCalledExactlyOnceWith('gh', ['api', `repos/${repository}/actions/artifacts/420/zip`], { env: { GH_TOKEN: 'test-token' }, stdout: { file: path.join(output, '42/420.zip') }, buffer: false })
    expect(await readdir(path.join(output, '42'))).toEqual([name, 'receipt.json'])
    expect(JSON.parse(await readFile(path.join(output, '42/receipt.json'), 'utf8'))).toMatchObject({ repository, runId: 42, runAttempt: 2, headSha: run.head_sha, verified: true, workflow: run.path })
  })
})

it.each(['expired', 'duplicate', 'wrong-sha', 'old-attempt', 'missing', 'reused-job', 'wrong-job-attempt', 'corrupt-zip'])(
  'ignores %s history while retaining deterministic full verification',
  async (kind) => {
    const value = fixture()
    const artifacts = value.artifacts.get(42)
    if (kind === 'expired') {
      artifacts[0].expired = true
    }
    if (kind === 'duplicate') {
      artifacts.push({ ...artifacts[0], id: 421 })
    }
    if (kind === 'wrong-sha') {
      artifacts[0].workflow_run.head_sha = 'b'.repeat(40)
    }
    if (kind === 'old-attempt') {
      artifacts[0].created_at = at(2)
    }
    if (kind === 'missing') {
      artifacts.pop()
    }
    if (kind === 'reused-job') {
      value.jobs.get(42)[0].started_at = at(2)
    }
    if (kind === 'wrong-job-attempt') {
      value.jobs.get(42)[0].run_attempt = 1
    }
    if (kind === 'corrupt-zip') {
      value.execute.mockImplementation(async (_, __, options) => writeFile(options.stdout.file, 'corrupt zip'))
    }
    await collect(value, async (result, output) => {
      expect(result).toEqual({ runIds: [], artifacts: 0 })
      expect(await readdir(output)).toEqual([])
    })
  },
)

it('follows run pages past unavailable reports and stops after ten trusted downloads', async () => {
  const runs = Array.from({ length: 13 }, (_, index) => ({ ...structuredClone(run), id: index + 1 }))
  const value = fixture(runs)
  value.runPages.splice(0, 1, runs.slice(0, 6), runs.slice(6))
  value.artifacts.set(1, [])
  value.jobs.get(2)[0].started_at = at(2)
  await collect(value, (result) => {
    expect(result.runIds).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(value.execute).toHaveBeenCalledTimes(10)
    expect(value.request.mock.calls.some(([url]) => url.includes('workflow') && url.endsWith('page=2'))).toBe(true)
    expect(value.request.mock.calls.some(([url]) => url.includes('created=%3E%3D2026-09-19T01%3A00%3A00.000Z'))).toBe(true)
  })
})

it('checks thirty-day and future boundaries independently of the server query', async () => {
  const value = fixture([
    { ...structuredClone(run), id: 1, run_started_at: at(30) },
    { ...structuredClone(run), id: 2, run_started_at: new Date(now - 30 * 86_400_000 - 1).toISOString() },
    { ...structuredClone(run), id: 3, updated_at: new Date(now + 1).toISOString() },
  ])
  await collect(value, result => expect(result.runIds).toEqual([1]))
})

it('downloads every artifact page before selecting the current report', async () => {
  const value = fixture()
  const original = value.request
  const artifact = value.artifacts.get(42)[0]
  value.request = async (url, options) => url.includes('/artifacts?') ? { ok: true, json: async () => ({ total_count: 2, artifacts: url.endsWith('page=1') ? [{ ...artifact, id: 99, created_at: at(2) }] : [artifact] }) } : original(url, options)
  await collect(value, result => expect(result.runIds).toEqual([42]))
})

it('connects three independently downloaded complete runs to the task-duration median', async () => {
  const plan = await freeze()
  const full = await aggregateVerificationReports(plan, shardReports(plan), { now: new Date(now) })
  const value = fixture([1, 2, 3].map(id => ({ ...structuredClone(run), id })), { 'index.json': full })
  const original = value.execute
  const durations = [100, 900, 300]
  value.execute = async (command, args, options) => {
    await original(command, args, options)
    const zip = new AdmZip(options.stdout.file)
    const report = structuredClone(full)
    report.tasks.forEach(task => task.durationMs = durations[Number(/\/artifacts\/(\d+)/u.exec(args[1])[1]) / 10 - 1])
    zip.updateFile('index.json', Buffer.from(JSON.stringify(report)))
    const bytes = zip.toBuffer()
    const artifact = value.artifacts.get(Number(/\/artifacts\/(\d+)/u.exec(args[1])[1]) / 10)[0]
    artifact.size_in_bytes = bytes.length
    artifact.digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    await writeFile(options.stdout.file, bytes)
  }
  await collect(value, async (result, output) => {
    const inputs = await Promise.all(result.runIds.map(async id => ({ receipt: JSON.parse(await readFile(path.join(output, String(id), 'receipt.json'), 'utf8')), reports: [JSON.parse(await readFile(path.join(output, String(id), name, 'index.json'), 'utf8'))] })))
    const history = collectDurationHistory(inputs, { profile, repository, workflow: run.path, now: new Date(now) })
    expect(history.tasks.a).toMatchObject({ durationMs: 300, samples: 3 })
    expect(history.tasks.a.sources).toHaveLength(3)
  })
})

function addHeadless(value, contents = { 'index.json': { provider: 'headless' } }) {
  const zip = new AdmZip()
  for (const [filename, content] of Object.entries(contents)) {
    zip.addFile(filename, Buffer.from(JSON.stringify(content)))
  }
  const bytes = zip.toBuffer()
  const artifact = { ...structuredClone(value.artifacts.get(42)[0]), id: 422, name: name.replace('miniapp-', 'ide-dom-headless-'), size_in_bytes: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` }
  value.artifacts.get(42).push(artifact)
  value.archives.set(artifact.id, bytes)
  return artifact
}

it.each(['both', 'headless-only', 'ordinary-corrupt', 'headless-corrupt', 'headless-expired'])('retains independently verified provider history: %s', async (kind) => {
  const value = fixture()
  const headless = addHeadless(value)
  if (kind === 'headless-only') {
    value.artifacts.get(42).shift()
  }
  if (kind === 'ordinary-corrupt') {
    value.archives.set(420, Buffer.from('corrupt'))
  }
  if (kind === 'headless-corrupt') {
    value.archives.set(422, Buffer.from('corrupt'))
  }
  if (kind === 'headless-expired') {
    headless.expired = true
  }
  await collect(value, async (result, output) => {
    expect(result).toEqual({ runIds: [42], artifacts: kind === 'both' ? 2 : 1 })
    const entries = await readdir(path.join(output, '42'))
    expect(entries.includes(name)).toBe(!['headless-only', 'ordinary-corrupt'].includes(kind))
    expect(entries.includes(headless.name)).toBe(!['headless-corrupt', 'headless-expired'].includes(kind))
    expect(entries.filter(entry => entry.endsWith('.zip'))).toEqual([])
  })
})

it('rejects both providers if the trusted run changes during download', async () => {
  const value = fixture()
  addHeadless(value)
  const original = value.request
  value.request = async (url, options) => /\/runs\/42$/u.test(new URL(url).pathname)
    ? { ok: true, json: async () => ({ ...run, run_attempt: 3 }) }
    : original(url, options)
  await collect(value, async (result, output) => {
    expect(result).toEqual({ runIds: [], artifacts: 0 })
    expect(await readdir(output)).toEqual([])
  })
})
