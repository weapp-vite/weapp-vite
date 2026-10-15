import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it, vi } from 'vitest'
import { matchesFilters, resolvePrContext, validatePrContext } from '../.github/scripts/pr-context.mjs'

const driverSha = 'a'.repeat(40)
const headSha = 'b'.repeat(40)
const baseSha = 'c'.repeat(40)
const mergeSha = 'd'.repeat(40)
const input = { repository: 'example/project', runId: '123', driverSha, refName: 'main', prNumber: '42' }
const pull = {
  number: 42,
  state: 'open',
  merge_commit_sha: mergeSha,
  head: { sha: headSha, ref: 'feature/change', repo: { full_name: 'contributor/project' } },
  base: { sha: baseSha, ref: 'main', repo: { full_name: input.repository } },
}
const merge = { sha: mergeSha, parents: [{ sha: baseSha }, { sha: headSha }] }
const respond = endpoint => endpoint.startsWith('/git/ref/') ? { object: { sha: baseSha } } : endpoint.startsWith('/git/commits/') ? merge : pull

describe('manual PR target resolution', () => {
  it('uses the invocation commit for standalone or scheduled validation without querying PRs', async () => {
    const get = vi.fn()
    expect(await resolvePrContext({ ...input, prNumber: '' }, get)).toMatchObject({
      isPr: false,
      shouldRun: true,
      prNumber: null,
      driverSha,
      headSha: driverSha,
      checkoutSha: driverSha,
      baseSha: '',
    })
    expect(get).not.toHaveBeenCalled()
  })

  it('freezes fork PR head and base independently of the main workflow commit', async () => {
    const get = vi.fn(respond)
    const context = await resolvePrContext(input, get)
    expect(context).toMatchObject({
      isPr: true,
      shouldRun: true,
      prNumber: 42,
      driverSha,
      headSha,
      baseSha,
      checkoutSha: mergeSha,
      checkoutMode: 'merge',
      headRef: pull.head.ref,
      baseRef: pull.base.ref,
      headRepository: pull.head.repo.full_name,
    })
    expect(get).toHaveBeenCalledWith('/pulls/42')
    expect(get).toHaveBeenCalledWith(`/git/commits/${mergeSha}`)
  })

  it('keeps head-only performance validation available without a merge candidate', async () => {
    const get = vi.fn(async endpoint => endpoint.startsWith('/git/ref/') ? respond(endpoint) : { ...pull, merge_commit_sha: null })
    expect(await resolvePrContext({ ...input, checkoutMode: 'head' }, get)).toMatchObject({ checkoutSha: headSha, checkoutMode: 'head' })
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('rejects unavailable or stale merge candidates instead of falling back to head', async () => {
    await expect(resolvePrContext(input, async endpoint => endpoint.startsWith('/git/ref/') ? respond(endpoint) : ({ ...pull, merge_commit_sha: null }))).rejects.toThrow('no merge candidate')
    for (const parents of [[{ sha: baseSha }], [{ sha: headSha }, { sha: baseSha }], [{ sha: driverSha }, { sha: headSha }]]) {
      await expect(resolvePrContext(input, async endpoint => endpoint.startsWith('/git/commits/') ? { ...merge, parents } : respond(endpoint))).rejects.toThrow('does not match')
    }
  })

  it('preserves frozen identity and attempt when target resolution fails', async () => {
    const error = await resolvePrContext({ ...input, runAttempt: 2 }, async endpoint => endpoint.startsWith('/git/ref/') ? respond(endpoint) : ({ ...pull, merge_commit_sha: null })).catch(error => error)
    expect(error.prContext).toMatchObject({
      runId: input.runId,
      runAttempt: 2,
      isPr: true,
      headSha,
      baseSha,
      checkoutSha: headSha,
      resolutionError: expect.stringContaining('no merge candidate'),
    })
    const get = vi.fn().mockRejectedValue(new Error('API unavailable'))
    const unidentified = await resolvePrContext(input, get).catch(error => error)
    expect(unidentified.prContext).toBeUndefined()
  })

  it('rejects a stale PR base snapshot before launching heavy checks or reading a merge candidate', async () => {
    const get = vi.fn(async endpoint => endpoint.startsWith('/git/ref/') ? { object: { sha: driverSha } } : respond(endpoint))
    const error = await resolvePrContext(input, get).catch(error => error)
    expect(error.message).toContain('base snapshot is stale')
    expect(error.prContext).toMatchObject({ headSha, baseSha, resolutionError: expect.stringContaining('refresh the PR branch') })
    expect(get.mock.calls.some(([endpoint]) => endpoint.startsWith('/git/commits/'))).toBe(false)
  })

  it.each(['0', '-1', '1;echo unsafe', '1\n2', '1.5', '9007199254740992'])('rejects invalid PR input %s before querying', async (prNumber) => {
    const get = vi.fn()
    await expect(resolvePrContext({ ...input, prNumber }, get)).rejects.toThrow('positive PR number')
    expect(get).not.toHaveBeenCalled()
  })

  it.each([
    { ...pull, state: 'closed' },
    { ...pull, base: { ...pull.base, repo: { full_name: 'another/project' } } },
    { ...pull, head: { ...pull.head, repo: null } },
  ])('rejects closed, foreign-target or deleted-source PRs', async (candidate) => {
    await expect(resolvePrContext(input, async () => candidate)).rejects.toThrow('open and target this repository')
  })

  it('preserves path filters and considers both sides of a rename', async () => {
    const get = vi.fn(async endpoint => endpoint.includes('/files?')
      ? [{ filename: 'docs/moved.md', previous_filename: 'packages/feature/old.ts' }]
      : respond(endpoint))
    expect((await resolvePrContext({ ...input, paths: ['packages/**'] }, get)).shouldRun).toBe(true)
    expect((await resolvePrContext({ ...input, paths: ['extensions/**'] }, get)).shouldRun).toBe(false)
  })

  it('preserves branch restrictions without querying files for an excluded base', async () => {
    const get = vi.fn().mockResolvedValue(pull)
    expect((await resolvePrContext({ ...input, baseBranches: ['next'], paths: ['packages/**'] }, get)).shouldRun).toBe(false)
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls.some(([endpoint]) => endpoint.includes('/files?') || endpoint.startsWith('/git/commits/'))).toBe(false)
  })

  it('keeps validation when the changed-files API reaches its truncation limit', async () => {
    const get = vi.fn(async endpoint => endpoint.includes('/files?')
      ? Array.from({ length: 100 }, (_, index) => ({ filename: `docs/${index}.md` }))
      : respond(endpoint))
    expect((await resolvePrContext({ ...input, paths: ['packages/**'] }, get)).shouldRun).toBe(true)
    expect(get.mock.calls.filter(([endpoint]) => endpoint.includes('/files?'))).toHaveLength(30)
  })

  it.each(['head', 'base'])('rejects %s movement while resolving the file scope', async (changed) => {
    let reads = 0
    const get = async (endpoint) => {
      if (endpoint.includes('/files?')) {
        return [{ filename: 'packages/feature/index.ts' }]
      }
      if (endpoint.startsWith('/git/commits/')) {
        return merge
      }
      if (endpoint.startsWith('/git/ref/')) {
        return respond(endpoint)
      }
      reads++
      return reads === 1 ? pull : { ...pull, [changed]: { ...pull[changed], sha: 'd'.repeat(40) } }
    }
    await expect(resolvePrContext({ ...input, paths: ['packages/**'] }, get)).rejects.toThrow('PR changed')
  })

  it('rechecks head/base even when there are no path filters', async () => {
    let reads = 0
    await expect(resolvePrContext(input, async (endpoint) => {
      if (endpoint.startsWith('/git/commits/')) {
        return merge
      }
      if (endpoint.startsWith('/git/ref/')) {
        return respond(endpoint)
      }
      return ++reads === 1 ? pull : { ...pull, head: { ...pull.head, sha: driverSha } }
    })).rejects.toThrow('PR changed')
  })

  it('supports ordered negative patterns and package wildcard matches', () => {
    expect(matchesFilters(['packages/agent-core/src/index.ts'], ['packages/agent-*/**'])).toBe(true)
    expect(matchesFilters(['packages/core/test/example.ts'], ['packages/**', '!packages/**/test/**'])).toBe(false)
    expect(matchesFilters(['packages/core/test/public.ts'], ['packages/**', '!packages/**/test/**', 'packages/**/test/public.ts'])).toBe(true)
  })
})

describe('manual PR reporting identity', () => {
  it('binds PR evidence to its dispatch run, preserving the separate candidate SHA', async () => {
    const context = await resolvePrContext(input, respond)
    const run = { id: Number(input.runId), head_sha: driverSha, event: 'workflow_dispatch' }
    expect(validatePrContext(context, run, input.repository)).toBe(context)
    for (const changed of [
      { ...context, driverSha: headSha },
      { ...context, runId: '456' },
      { ...context, repository: 'another/project' },
      { ...context, checkoutSha: 'invalid' },
      { ...context, checkoutMode: 'head' },
      { ...context, baseSha: 'invalid' },
    ]) {
      expect(() => validatePrContext(changed, run, input.repository)).toThrow()
    }
    expect(() => validatePrContext(context, { ...run, event: 'push' }, input.repository)).toThrow()
  })
})

it('writes and verifies build manifests against the candidate SHA rather than the main dispatch SHA', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pr-artifact-identity-'))
  try {
    await mkdir(path.join(directory, 'packages/example/dist'), { recursive: true })
    await writeFile(path.join(directory, 'packages/example/dist/index.js'), 'export const value = 1\n')
    const env = { ...process.env, GITHUB_SHA: driverSha, BUILD_ARTIFACT_EXPECTED_COMMIT: mergeSha }
    execFileSync(process.execPath, [path.resolve(import.meta.dirname, 'create-build-artifact-manifest.mjs')], { cwd: directory, env })
    const manifest = JSON.parse(await readFile(path.join(directory, '.tmp/build-artifact-manifest.json'), 'utf8'))
    expect(manifest.commit).toBe(mergeSha)
    execFileSync(process.execPath, [path.resolve(import.meta.dirname, 'verify-build-artifact-manifest.mjs')], { cwd: directory, env })
    expect(() => execFileSync(process.execPath, [path.resolve(import.meta.dirname, 'verify-build-artifact-manifest.mjs')], {
      cwd: directory,
      env: { ...env, BUILD_ARTIFACT_EXPECTED_COMMIT: driverSha },
      stdio: 'pipe',
    })).toThrow()
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
})
