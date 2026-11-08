import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { resolveNativePrContext, validateNativePrContext } from '../.github/scripts/native-pr-context.mjs'
import { verifyNativePrContext } from '../.github/scripts/native-pr-identity.mjs'
import { nativeRefreshPinsFromRun, nativeRefreshTitle, parseNativeRefreshInputs } from '../.github/scripts/native-pr-refresh.mjs'

const repository = 'example/project'
const control = 'a'.repeat(40)
const head = 'b'.repeat(40)
const base = 'c'.repeat(40)
const merge = 'd'.repeat(40)
const other = 'e'.repeat(40)
const pins = { prNumber: 42, headSha: head, baseSha: base, checkoutSha: merge }
const inputs = { 'pr-number': '42', 'head-sha': head, 'base-sha': base, 'merge-sha': merge }

function fixture() {
  const repo = { id: 1, full_name: repository, default_branch: 'main' }
  const pull = { number: 42, state: 'open', merge_commit_sha: other, head: { sha: head, ref: 'feature', repo: { id: 2, full_name: 'contributor/project' } }, base: { sha: other, ref: 'main', repo } }
  const run = { id: 123, run_attempt: 1, name: 'PR CI', event: 'workflow_dispatch', path: '.github/workflows/ci-pr.yml', head_sha: control, head_branch: 'main', repository: repo, head_repository: repo, display_title: nativeRefreshTitle(pins), pull_requests: [], referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${control}`, sha: control, ref: 'refs/heads/main' }] }
  const forkRun = { id: 99, run_attempt: 1, name: 'PR CI', event: 'pull_request', path: '.github/workflows/ci-pr.yml', repository: repo, head_repository: pull.head.repo, head_sha: head, head_branch: 'feature', pull_requests: [structuredClone(pull)], referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${merge}`, sha: merge, ref: 'refs/pull/42/merge' }] }
  const state = { repo, pull, run, forkRun, forkJobs: [{ name: 'Approve PR checks', head_sha: head, run_id: 99, run_attempt: 1, status: 'waiting' }], base, canonical: merge, parents: [{ sha: base }, { sha: head }], files: [{ filename: 'packages/example/index.ts', status: 'modified' }] }
  const calls = []
  const get = async (endpoint) => {
    calls.push(endpoint)
    if (endpoint === '') {
      return structuredClone(state.repo)
    }
    if (endpoint === '/actions/runs/123') {
      return structuredClone(state.run)
    }
    if (endpoint === '/actions/runs/99') {
      return structuredClone(state.forkRun)
    }
    if (endpoint.startsWith('/actions/workflows/ci-pr.yml/runs?')) {
      return { workflow_runs: [structuredClone(state.forkRun)] }
    }
    if (endpoint.startsWith('/actions/runs/99/jobs?')) {
      return { jobs: structuredClone(state.forkJobs) }
    }
    if (endpoint === '/pulls/42') {
      return structuredClone(state.pull)
    }
    if (endpoint === '/git/ref/heads/main') {
      return { ref: 'refs/heads/main', object: { sha: state.base } }
    }
    if (endpoint === '/git/ref/pull/42/merge') {
      return { ref: 'refs/pull/42/merge', object: { sha: state.canonical } }
    }
    if (endpoint === `/git/commits/${merge}`) {
      return { sha: merge, parents: state.parents }
    }
    if (endpoint.startsWith('/pulls/42/files?')) {
      return structuredClone(state.files)
    }
    if (endpoint === `/contents/.github/verification-workload.json?ref=${merge}`) {
      const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, draft: false, id: 'refresh-test', pullRequests: [99], baseBranch: 'main', profiles: ['ci'] }))
      return { type: 'file', path: '.github/verification-workload.json', encoding: 'base64', content: bytes.toString('base64'), sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }
    }
    throw new Error(`Unexpected API: ${endpoint}`)
  }
  const options = { repository, runId: 123, runAttempt: 1, driverSha: control, eventName: 'workflow_dispatch', refName: 'refs/heads/main', event: { inputs: structuredClone(inputs) }, profiles: { ci: { paths: [], baseBranches: [], checkoutMode: 'merge' } } }
  return { state, get, options, calls }
}

describe('protected native refresh admission', () => {
  it('completes a fresh pinned tuple while keeping control and tested source distinct', async () => {
    const { state, get, options } = fixture()
    const context = await resolveNativePrContext(options, get)
    expect(context).toMatchObject({ ...pins, event: 'native_refresh', driverSha: control, checkoutSha: merge, baseRepositoryId: 1, headRepositoryId: 2, headRepository: 'contributor/project', selections: { ci: true } })
    expect(context.driverSha).not.toBe(context.checkoutSha)
    expect(validateNativePrContext(context, state.run, repository, 'main')).toBe(context)
    expect(() => validateNativePrContext(context, state.run, repository)).toThrow()
    expect(await verifyNativePrContext(context, state.run, repository, get)).toMatchObject({ valid: true })
  })

  it('does not bypass GitHub native fork review or inherit the source Environment approval', async () => {
    const { state, get, options } = fixture()
    state.forkJobs = []
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('fork source has not passed')
    state.forkJobs = [{ name: 'Approve PR checks', head_sha: head, run_id: 99, run_attempt: 1, status: 'waiting' }]
    const context = await resolveNativePrContext(options, get)
    expect(context.forkSourceRunId).toBe(99)
    expect(context.runId).toBe('123')
    state.forkRun.head_sha = other
    await expect(verifyNativePrContext(context, state.run, repository, get)).rejects.toThrow('fork source has not passed')
  })

  it('rejects a pinned request after the live base advances rather than editing its tuple', async () => {
    const { state, get, options } = fixture()
    state.base = other
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('target is stale')
    expect(options.event.inputs).toEqual(inputs)
  })

  it.each(['refs/heads/feature', 'refs/tags/main', 'main', undefined])('rejects control ref %s before candidate reads', async (refName) => {
    const { get, options, calls } = fixture()
    await expect(resolveNativePrContext({ ...options, refName }, get)).rejects.toThrow('default branch')
    expect(calls).toEqual([''])
  })

  it.each([
    ['event', run => run.event = 'pull_request'],
    ['path', run => run.path = '.github/workflows/ci.yml'],
    ['control SHA', run => run.head_sha = other],
    ['control branch', run => run.head_branch = 'feature'],
    ['attempt', run => run.run_attempt = 2],
    ['repository', run => run.repository = { id: 3, full_name: 'other/project' }],
    ['source repository', run => run.head_repository = { id: 2, full_name: 'contributor/project' }],
    ['pinned title head', run => run.display_title = nativeRefreshTitle({ ...pins, headSha: other })],
    ['pinned title base', run => run.display_title = nativeRefreshTitle({ ...pins, baseSha: other })],
    ['pinned title merge', run => run.display_title = nativeRefreshTitle({ ...pins, checkoutSha: other })],
    ['invocation ref', run => run.referenced_workflows[0].ref = 'refs/pull/42/merge'],
    ['invocation SHA', run => run.referenced_workflows[0].sha = other],
    ['missing invocation', run => run.referenced_workflows = []],
  ])('rejects %s provenance substitution before reading the target PR', async (_name, mutate) => {
    const { state, get, options, calls } = fixture()
    mutate(state.run)
    await expect(resolveNativePrContext(options, get)).rejects.toThrow(/Untrusted native refresh/u)
    expect(calls).toEqual(['', '/actions/runs/123'])
  })

  it.each([
    ['head', state => state.pull.head.sha = other],
    ['base repository', state => state.pull.base.repo = { id: 3, full_name: repository }],
    ['canonical merge', state => state.canonical = other],
    ['first parent', state => state.parents[0].sha = other],
    ['second parent', state => state.parents[1].sha = other],
    ['reversed parents', state => state.parents.reverse()],
    ['extra parent', state => state.parents.push({ sha: other })],
  ])('rejects %s target substitution without adopting fresh mutable values', async (_name, mutate) => {
    const { state, get, options } = fixture()
    mutate(state)
    await expect(resolveNativePrContext(options, get)).rejects.toThrow(/Native refresh/u)
    expect(options.event.inputs).toEqual(inputs)
  })

  it.each(['base', 'head', 'canonical'])('rejects %s movement after changed-file selection', async (key) => {
    const { state, get, options } = fixture()
    const moving = async (endpoint) => {
      const response = await get(endpoint)
      if (endpoint.includes('/files?')) {
        if (key === 'base') {
          state.base = other
        }
        if (key === 'head') {
          state.pull.head.sha = other
        }
        if (key === 'canonical') {
          state.canonical = other
        }
      }
      return response
    }
    await expect(resolveNativePrContext(options, moving)).rejects.toThrow('while selecting checks')
  })

  it.each(['base', 'head', 'canonical'])('excludes completed evidence after %s movement', async (key) => {
    const { state, get, options } = fixture()
    const context = await resolveNativePrContext(options, get)
    if (key === 'base') {
      state.base = other
    }
    if (key === 'head') {
      state.pull.head.sha = other
    }
    if (key === 'canonical') {
      state.canonical = other
    }
    expect((await verifyNativePrContext(context, state.run, repository, get)).valid).toBe(false)
  })

  it('does not turn an old native event into a refresh request by copying context pins', async () => {
    const { state, get, options } = fixture()
    state.run.event = 'pull_request'
    state.run.head_sha = head
    state.run.head_branch = 'feature'
    state.run.head_repository = state.pull.head.repo
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('run identity')
  })
})

describe('immutable refresh request framing', () => {
  it('parses full request and service-recorded title to the same tuple', () => {
    expect(parseNativeRefreshInputs(inputs)).toEqual(pins)
    expect(nativeRefreshPinsFromRun({ display_title: nativeRefreshTitle(pins) })).toEqual(pins)
  })

  it.each([
    { 'pr-number': '042' },
    { 'pr-number': '42\n' },
    { 'pr-number': '0' },
    { 'pr-number': '9007199254740992' },
    { 'head-sha': `${head}\n` },
    { 'base-sha': 'main' },
    { 'merge-sha': head.slice(1) },
    { 'head-sha': head.toUpperCase() },
  ])('rejects ambiguous or unpinned input %j', (change) => {
    expect(() => parseNativeRefreshInputs({ ...inputs, ...change })).toThrow('refresh pins')
  })

  it('rejects extra and missing fields rather than deriving a newer target', () => {
    expect(() => parseNativeRefreshInputs({ ...inputs, unexpected: 'current' })).toThrow('refresh inputs')
    const incomplete = { ...inputs }
    delete incomplete['merge-sha']
    expect(() => parseNativeRefreshInputs(incomplete)).toThrow('refresh inputs')
  })
})
