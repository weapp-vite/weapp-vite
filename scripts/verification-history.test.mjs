import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { downloadVerificationHistory, trustedHistoryRun } from '../.github/scripts/verification-history.mjs'

const repository = 'example/project'
const run = { id: 42, run_attempt: 2, status: 'completed', conclusion: 'success', event: 'push', path: '.github/workflows/ci-e2e.yml', head_branch: 'main', head_repository: { full_name: repository }, head_sha: 'a'.repeat(40) }
const artifact = { id: 7, name: 'miniapp-aggregate-ubuntu-latest-node-22-full', expired: false, workflow_run: { id: run.id, head_sha: run.head_sha } }

it('accepts only independently verified complete default-branch workflow runs', () => {
  expect(trustedHistoryRun(run, repository, 'main')).toBe(true)
  for (const mutation of [{ event: 'pull_request' }, { head_branch: 'feature' }, { path: 'another.yml' }, { conclusion: 'failure' }, { status: 'in_progress' }, { run_attempt: 0 }, { head_repository: { full_name: 'other/project' } }]) {
    expect(trustedHistoryRun({ ...run, ...mutation }, repository, 'main')).toBe(false)
  }
})

it('downloads only the matching aggregate and writes an API-derived receipt', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'verification-history-'))
  const execute = vi.fn(async () => {})
  const request = vi.fn(async url => ({ ok: true, json: async () => url.includes('/artifacts?') ? { total_count: 2, artifacts: [artifact, { ...artifact, id: 8, name: 'raw-shard' }] } : { workflow_runs: [{ ...run, event: 'pull_request' }, run] } }))
  try {
    await expect(downloadVerificationHistory({ repository, defaultBranch: 'main', os: 'ubuntu-latest', nodeMajor: '22', output, token: 'test-token' }, request, execute)).resolves.toEqual({ runId: 42, artifacts: 1 })
    expect(execute).toHaveBeenCalledExactlyOnceWith('gh', ['run', 'download', '42', '--repo', repository, '--name', artifact.name, '--dir', path.join(output, '42', artifact.name)], { env: { GH_TOKEN: 'test-token' }, stdio: 'inherit' })
    expect(JSON.parse(await readFile(path.join(output, '42/receipt.json'), 'utf8'))).toMatchObject({ repository, runId: 42, runAttempt: 2, headSha: run.head_sha, verified: true, workflow: run.path })
  }
  finally {
    await rm(output, { recursive: true, force: true })
  }
})

it.each(['expired', 'duplicate', 'wrong-sha'])('falls back to a complete deterministic plan when history is %s', async (kind) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'verification-history-'))
  const records = kind === 'expired' ? [{ ...artifact, expired: true }] : kind === 'duplicate' ? [artifact, { ...artifact, id: 8 }] : [{ ...artifact, workflow_run: { ...artifact.workflow_run, head_sha: 'b'.repeat(40) } }]
  const execute = vi.fn()
  const request = async url => ({ ok: true, json: async () => url.includes('/artifacts?') ? { total_count: records.length, artifacts: records } : { workflow_runs: [run] } })
  try {
    await expect(downloadVerificationHistory({ repository, defaultBranch: 'main', os: 'ubuntu-latest', nodeMajor: 22, output }, request, execute)).resolves.toEqual({ runId: null, artifacts: 0 })
    expect(execute).not.toHaveBeenCalled()
    expect(await readdir(output)).toEqual([])
  }
  finally {
    await rm(output, { recursive: true, force: true })
  }
})
