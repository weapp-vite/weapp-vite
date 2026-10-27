import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { assertFrozenJobContext } from '../.github/scripts/validate-job-pr-context.mjs'

const sha = value => value.repeat(40)
const context = {
  schemaVersion: 1,
  event: 'pull_request',
  repository: 'example/project',
  runId: '123',
  runAttempt: 2,
  isPr: true,
  shouldRun: true,
  prNumber: 42,
  headSha: sha('a'),
  baseSha: sha('b'),
  driverSha: sha('c'),
  checkoutSha: sha('c'),
  checkoutMode: 'merge',
  headRef: 'feature',
  baseRef: 'main',
  headRepository: 'example/fork',
  selections: { ci: true, smoke: true, skipped: false },
}
const env = { GITHUB_REPOSITORY: context.repository, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', GITHUB_SHA: sha('c') }

describe('frozen context inside actual jobs', () => {
  it('validates both the merge and explicitly projected head without network access', () => {
    expect(assertFrozenJobContext(context, { checkoutMode: 'merge' }, 'ci', sha('c'), env).checkoutSha).toBe(sha('c'))
    expect(assertFrozenJobContext(context, { checkoutMode: 'head' }, 'smoke', sha('a'), env).checkoutSha).toBe(sha('a'))
  })

  it.each([
    [{ ...env, GITHUB_REPOSITORY: 'other/project' }, sha('c')],
    [{ ...env, GITHUB_RUN_ATTEMPT: '3' }, sha('c')],
    [{ ...env, GITHUB_SHA: sha('d') }, sha('c')],
    [env, sha('d')],
  ])('rejects stale or mismatched identities', (environment, checkout) => {
    expect(() => assertFrozenJobContext(context, { checkoutMode: 'merge' }, 'ci', checkout, environment)).toThrow()
  })

  it('checks documentation and topology without treating all skipped product profiles as selected', () => {
    const docs = { ...context, documentationOnly: true, verificationTopology: 'optimized-v1' }
    expect(assertFrozenJobContext(docs, undefined, 'documentation', sha('c'), { ...env, PR_TOPOLOGY: 'optimized-v1' }).shouldRun).toBe(true)
    expect(() => assertFrozenJobContext(docs, undefined, 'documentation', sha('c'), { ...env, PR_TOPOLOGY: 'optimized-v2' })).toThrow('topology')
    expect(() => assertFrozenJobContext(context, undefined, 'documentation', sha('c'), env)).toThrow('Unselected')
  })

  it('refuses unselected profiles and preserves manual reference contexts', () => {
    expect(() => assertFrozenJobContext(context, { checkoutMode: 'merge' }, 'skipped', sha('c'), env)).toThrow('Unselected')
    const manual = { ...context, event: undefined, isPr: false, checkoutMode: 'ref', selections: undefined }
    expect(assertFrozenJobContext(manual, { checkoutMode: 'head' }, 'smoke', sha('c'), env).checkoutSha).toBe(sha('c'))
  })
})

it('validates an older PR head without loading the validator from that head', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'frozen-old-head-'))
  const execute = promisify(execFile)
  try {
    await execute('git', ['init', '--quiet', directory])
    await writeFile(path.join(directory, 'old-source.txt'), 'head predates the validation action\n')
    await execute('git', ['add', 'old-source.txt'], { cwd: directory })
    await execute('git', ['-c', 'user.name=Contract', '-c', 'user.email=contract@example.test', 'commit', '--quiet', '-m', 'Initial fixture'], { cwd: directory })
    const { stdout } = await execute('git', ['rev-parse', 'HEAD'], { cwd: directory })
    const headSha = stdout.trim()
    const frozen = { ...context, headSha, verificationTopology: 'optimized-v2', selections: { 'ci-performance': true } }
    const helper = fileURLToPath(new URL('../.github/scripts/validate-job-pr-context.mjs', import.meta.url))
    const result = await execute(process.execPath, [helper], { cwd: directory, env: { ...process.env, ...env, PR_PROFILE: 'ci-performance', PR_TOPOLOGY: 'optimized-v2', PR_FROZEN_CONTEXT: JSON.stringify(frozen) } })
    expect(result.stderr).toBe('')
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
