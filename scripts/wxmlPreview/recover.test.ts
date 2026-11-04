import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { archiveIntegrity, PACKAGE_NAME, REGISTRY } from './contract.ts'
import { recoverPreview, recoveryRun } from './recover.ts'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), confirm: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('./confirm.ts', () => ({ confirmPreview: mocks.confirm }))
const repository = 'weapp-vite/weapp-vite'
const run = { id: 123, repository: { full_name: repository }, head_repository: { full_name: repository }, head_branch: 'main', path: '.github/workflows/wxml-preview.yml', event: 'workflow_dispatch', status: 'completed', run_attempt: 1, head_sha: 'a'.repeat(40) }
let directory: string | undefined

afterEach(async () => {
  vi.resetAllMocks()
  if (directory) {
    await rm(directory, { recursive: true, force: true })
    directory = undefined
  }
})

it('accepts only the original completed publisher identity and default-branch source', () => {
  expect(recoveryRun(run, repository, 'main', '123')).toEqual({ sha: run.head_sha, attempt: 1 })
  for (const change of [
    { id: 124 },
    { repository: { full_name: 'other/repo' } },
    { head_repository: { full_name: 'fork/repo' } },
    { head_branch: 'feature' },
    { path: '.github/workflows/release.yml' },
    { event: 'pull_request' },
    { status: 'in_progress' },
    { head_sha: 'invalid' },
    { run_attempt: 0 },
  ]) {
    expect(() => recoveryRun({ ...run, ...change }, repository, 'main', '123')).toThrow()
  }
})

it('reuses the original bytes and source identity without packing or publishing', async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'wxml-recovery-'))
  const version = '0.1.0-alpha.0'
  const archive = Buffer.from('immutable published archive')
  const original = { schemaVersion: 1, name: PACKAGE_NAME, version, tag: 'alpha', registry: REGISTRY, sourceSha: run.head_sha, latestBefore: '0.0.0-stage', tarball: `/old-runner/weapp-vite-wxml-${version}.tgz`, integrity: archiveIntegrity(archive), files: [{ path: 'dist/index.mjs', size: 1 }], dist: [{ path: 'dist/index.mjs', size: 1, sha256: 'a'.repeat(64) }] }
  const env = { GITHUB_REPOSITORY: repository, GITHUB_REF: 'refs/heads/main', DEFAULT_BRANCH: 'main', GITHUB_SHA: 'b'.repeat(40), RUNNER_TEMP: directory, PREVIEW_VERSION: version, PREVIEW_VERIFY_RUN_ID: '123' }
  mocks.execute.mockImplementation(async (_command: string, args: string[]) => {
    if (args[0] === 'api') {
      const endpoint = args.at(-1)!
      const data = endpoint.endsWith('/jobs?per_page=100')
        ? [{ jobs: [{ name: 'Check and publish WXML alpha', steps: [{ name: 'Publish using npm OIDC', conclusion: 'success' }] }] }]
        : endpoint.endsWith('/artifacts?per_page=100')
          ? [{ artifacts: [{ name: 'wxml-preview-123-1', expired: false }] }]
          : run
      return { stdout: JSON.stringify(data) }
    }
    expect(args).toEqual(['run', 'download', '123', '--repo', repository, '--name', 'wxml-preview-123-1', '--dir', path.join(directory!, 'wxml-preview')])
    await writeFile(path.join(directory!, 'wxml-preview/manifest.json'), JSON.stringify(original))
    await writeFile(path.join(directory!, 'wxml-preview/confirmed.json'), 'original confirmation')
    await writeFile(path.join(directory!, `wxml-preview/weapp-vite-wxml-${version}.tgz`), archive)
    return { stdout: '' }
  })
  mocks.confirm.mockResolvedValue({ summary: 'confirmed' })
  expect(await recoverPreview(env)).toEqual({ summary: 'confirmed' })
  expect(mocks.confirm).toHaveBeenCalledWith({ manifest: path.join(directory, 'wxml-preview/manifest.json'), env: { ...env, GITHUB_SHA: run.head_sha } })
  const saved = JSON.parse(await readFile(path.join(directory, 'wxml-preview/recovery.json'), 'utf8')) as Record<string, unknown>
  expect(saved).toMatchObject({ originalRunId: '123', originalSourceSha: run.head_sha, verifierSha: env.GITHUB_SHA })
  expect(await readFile(path.join(directory, 'wxml-preview/original-confirmed.json'), 'utf8')).toBe('original confirmation')
  expect(mocks.execute.mock.calls.every(([command]) => command === 'gh')).toBe(true)
})

it('rejects malformed recovery inputs before executing any command', async () => {
  for (const id of ['', '1;echo bad', '0', '1\n2']) {
    await expect(recoverPreview({ PREVIEW_VERIFY_RUN_ID: id })).rejects.toThrow('numeric run id')
  }
  expect(mocks.execute).not.toHaveBeenCalled()
})
