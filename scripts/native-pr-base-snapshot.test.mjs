import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { resolveNativePrContext } from '../.github/scripts/native-pr-context.mjs'
import { publishNativePrReport } from '../.github/scripts/publish-native-pr-report.mjs'

const repository = 'example/project'
const baseSha = 'a'.repeat(40)
const headSha = 'b'.repeat(40)
const mergeSha = 'c'.repeat(40)
const staleSha = 'd'.repeat(40)
const pull = {
  number: 42,
  state: 'open',
  merge_commit_sha: mergeSha,
  head: { sha: headSha, ref: 'feature', repo: { id: 2, full_name: 'contributor/project' } },
  base: { sha: staleSha, ref: 'main', repo: { id: 1, full_name: repository } },
}
const run = {
  id: 123,
  run_attempt: 1,
  name: 'PR CI',
  event: 'pull_request',
  path: '.github/workflows/ci-pr.yml',
  status: 'completed',
  conclusion: 'success',
  head_sha: headSha,
  head_branch: pull.head.ref,
  repository: pull.base.repo,
  head_repository: pull.head.repo,
  pull_requests: [],
  referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${mergeSha}`, sha: mergeSha, ref: 'refs/pull/42/merge' }],
}
const context = {
  schemaVersion: 1,
  event: 'pull_request',
  repository,
  runId: '123',
  runAttempt: 1,
  driverSha: mergeSha,
  isPr: true,
  shouldRun: true,
  prNumber: 42,
  headSha,
  baseSha,
  headRef: 'feature',
  baseRef: 'main',
  headRepository: pull.head.repo.full_name,
  checkoutSha: mergeSha,
  checkoutMode: 'merge',
  selections: { ci: true },
}

function fixture() {
  const state = { pull: structuredClone(pull), run: { ...structuredClone(run), pull_requests: [structuredClone(pull)] }, baseSha, mergeSha, parents: [{ sha: baseSha }, { sha: headSha }] }
  const get = vi.fn(async (endpoint) => {
    if (endpoint === '/pulls/42') {
      return structuredClone(state.pull)
    }
    if (endpoint === '/actions/runs/123') {
      return structuredClone(state.run)
    }
    if (endpoint === '/git/ref/heads/main') {
      return { ref: 'refs/heads/main', object: { sha: state.baseSha } }
    }
    if (endpoint === '/git/ref/pull/42/merge') {
      return { ref: 'refs/pull/42/merge', object: { sha: state.mergeSha } }
    }
    if (endpoint === `/git/commits/${mergeSha}`) {
      return { sha: mergeSha, parents: state.parents }
    }
    if (endpoint.startsWith('/pulls/42/files?')) {
      return [{ filename: 'packages/example/index.ts' }]
    }
    if (endpoint.startsWith('/contents/')) {
      const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, draft: false, id: 'identity-test-v1', pullRequests: [43], baseBranch: 'main', profiles: ['ci'] }))
      return { type: 'file', path: '.github/verification-workload.json', encoding: 'base64', content: bytes.toString('base64'), sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }
    }
    if (endpoint.startsWith('/actions/workflows/')) {
      return { workflow_runs: [state.run] }
    }
    throw new Error(`Unexpected API: ${endpoint}`)
  })
  const options = { repository, runId: 123, runAttempt: 1, driverSha: mergeSha, event: { number: 42, pull_request: pull }, profiles: { ci: { paths: [], baseBranches: [], checkoutMode: 'merge' } } }
  const report = { repository, run: state.run, context: structuredClone(context), jobs: ['Approve PR checks', 'Freeze approved PR target'].map(name => ({ name, conclusion: 'success' })), request: get, readArtifact: vi.fn() }
  return { state, get, options, report }
}

describe('native PR base snapshot regression', () => {
  it('freezes the live base and actual merge despite stale REST and event base metadata', async () => {
    const { state, get, options } = fixture()
    state.run.pull_requests = []
    await expect(resolveNativePrContext(options, get)).resolves.toMatchObject(context)
  })

  it.each([staleSha, null])('ignores a stale event merge snapshot %s while freezing the actual driver', async (eventMerge) => {
    const { get, options } = fixture()
    options.event = { number: 42, pull_request: { ...pull, merge_commit_sha: eventMerge } }
    await expect(resolveNativePrContext(options, get)).resolves.toMatchObject(context)
  })

  it('rejects a live merge candidate whose driver is stale even if event and invocation match', async () => {
    const { state, get, options } = fixture()
    state.pull.merge_commit_sha = staleSha
    await expect(resolveNativePrContext(options, get)).rejects.toThrow()
  })

  it('does not accept an unassociated fork artifact on matching live evidence alone', async () => {
    const { state, get, report } = fixture()
    state.run.pull_requests = []
    await expect(publishNativePrReport(report)).resolves.toEqual({ published: false, reason: 'unassociated-pr' })
    expect(get).not.toHaveBeenCalled()
    expect(report.readArtifact).not.toHaveBeenCalled()
  })

  it('rejects another PR selected by forged workflow references on an unassociated run', async () => {
    const { state, get, report } = fixture()
    state.run.pull_requests = []
    state.run.referenced_workflows[0].ref = 'refs/pull/43/merge'
    report.context.prNumber = 43
    await expect(publishNativePrReport(report)).resolves.toEqual({ published: false, reason: 'unassociated-pr' })
    expect(get).not.toHaveBeenCalled()
    expect(report.readArtifact).not.toHaveBeenCalled()
  })

  it('accepts stale associated base metadata only with independent live merge proof', async () => {
    const { report } = fixture()
    await expect(publishNativePrReport(report)).resolves.toEqual({ published: true })
  })

  it.each(['head', 'head-ref', 'head-repository', 'base-ref', 'base-repository'])('rejects %s changes while awaiting approval', async (changed) => {
    const { state, get, options } = fixture()
    if (changed === 'head') {
      state.pull.head.sha = staleSha
    }
    if (changed === 'head-ref') {
      state.pull.head.ref = 'another'
    }
    if (changed === 'head-repository') {
      state.pull.head.repo.id = 3
    }
    if (changed === 'base-ref') {
      state.pull.base.ref = 'next'
    }
    if (changed === 'base-repository') {
      state.pull.base.repo.id = 3
    }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow()
  })

  it.each(['base', 'head', 'head-ref', 'head-repository', 'base-ref', 'base-repository', 'merge'])('rejects %s movement during profile selection', async (changed) => {
    const { state, get, options } = fixture()
    const moving = async (endpoint) => {
      const response = await get(endpoint)
      if (endpoint.startsWith('/pulls/42/files?')) {
        if (changed === 'base') {
          state.baseSha = staleSha
        }
        if (changed === 'head') {
          state.pull.head.sha = staleSha
        }
        if (changed === 'head-ref') {
          state.pull.head.ref = 'another'
        }
        if (changed === 'head-repository') {
          state.pull.head.repo.id = 3
        }
        if (changed === 'base-ref') {
          state.pull.base.ref = 'next'
        }
        if (changed === 'base-repository') {
          state.pull.base.repo.id = 3
        }
        if (changed === 'merge') {
          state.mergeSha = staleSha
        }
      }
      return response
    }
    await expect(resolveNativePrContext(options, moving)).rejects.toThrow('while selecting checks')
  })

  it('rejects an invocation driver mismatch instead of changing the run to the current merge', async () => {
    const { get, options } = fixture()
    options.driverSha = staleSha
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('invocation proof')
  })

  it.each(['head_branch', 'head_repository', 'repository', 'head_sha', 'run_attempt'])('requires immutable run field %s even for an empty fork association', async (field) => {
    const { state, report, get, options } = fixture()
    state.run.pull_requests = []
    delete state.run[field]
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('run identity')
    await expect(publishNativePrReport(report)).rejects.toThrow(/run identity|completed PR CI run/u)
    expect(report.readArtifact).not.toHaveBeenCalled()
  })

  it.each(['head-ref', 'repository-id', 'base', 'merge-ref', 'merge-parents', 'context-pr', 'context-driver', 'contradicting-association'])('rejects forged fork evidence: %s', async (changed) => {
    const { state, report } = fixture()
    if (changed === 'head-ref') {
      report.context.headRef = 'another'
    }
    if (changed === 'repository-id') {
      state.pull.head.repo.id = 3
    }
    if (changed === 'base') {
      state.baseSha = staleSha
    }
    if (changed === 'merge-ref') {
      state.mergeSha = staleSha
    }
    if (changed === 'merge-parents') {
      state.parents.reverse()
    }
    if (changed === 'context-pr') {
      report.context.prNumber = 43
    }
    if (changed === 'context-driver') {
      report.context.driverSha = staleSha
      report.context.checkoutSha = staleSha
    }
    if (changed === 'contradicting-association') {
      state.run.pull_requests = [{ ...pull, number: 43 }]
    }
    const result = await publishNativePrReport(report).catch(error => ({ error }))
    expect(result.published).not.toBe(true)
    expect(report.readArtifact).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', value => delete value.referenced_workflows],
    ['empty', value => value.referenced_workflows = []],
    ['missing-ref', value => delete value.referenced_workflows[0].ref],
    ['missing-sha', value => delete value.referenced_workflows[0].sha],
    ['missing-path', value => delete value.referenced_workflows[0].path],
    ['wrong-ref', value => value.referenced_workflows[0].ref = 'refs/pull/43/merge'],
    ['wrong-sha', value => value.referenced_workflows[0].sha = staleSha],
    ['wrong-path-sha', value => value.referenced_workflows[0].path = `${repository}/.github/workflows/validate-ci.yml@${staleSha}`],
    ['wrong-path-directory', value => value.referenced_workflows[0].path = `${repository}/.github/actions/validate-ci.yml@${mergeSha}`],
    ['external-only', value => value.referenced_workflows[0].path = `another/project/.github/workflows/validate-ci.yml@${mergeSha}`],
    ['conflicting-owned-ref', value => value.referenced_workflows.push({ ...value.referenced_workflows[0], ref: 'refs/pull/43/merge' })],
    ['conflicting-owned-sha', value => value.referenced_workflows.push({ ...value.referenced_workflows[0], sha: staleSha })],
    ['conflicting-owned-path', value => value.referenced_workflows.push({ ...value.referenced_workflows[0], path: `${repository}/.github/workflows/other.yml@${staleSha}` })],
    ['unclassifiable-path', value => value.referenced_workflows.push({ sha: staleSha, ref: 'refs/pull/43/merge' })],
  ])('rejects %s invocation proof before planner or reporter reads live PR evidence', async (_, mutate) => {
    const { state, get, options, report } = fixture()
    mutate(state.run)
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('invocation proof')
    expect(get.mock.calls).toEqual([['/actions/runs/123']])
    get.mockClear()
    await expect(publishNativePrReport(report)).rejects.toThrow('invocation proof')
    expect(get).not.toHaveBeenCalled()
    expect(report.readArtifact).not.toHaveBeenCalled()
  })

  it('accepts matching repository workflows alongside unrelated external references', async () => {
    const { state, report, options, get } = fixture()
    state.run.referenced_workflows.push(
      { ...state.run.referenced_workflows[0], path: `${repository}/.github/workflows/other.yml@${mergeSha}` },
      { path: `another/project/.github/workflows/external.yml@${staleSha}`, sha: staleSha, ref: 'refs/heads/main' },
    )
    await expect(resolveNativePrContext(options, get)).resolves.toMatchObject(context)
    await expect(publishNativePrReport(report)).resolves.toEqual({ published: true })
  })

  it.each(['another-pr-and-base', 'new-merge-after-base-update'])('rejects a same-head retarget even when all live evidence matches: %s', async (scenario) => {
    const { state, options, report, get } = fixture()
    state.run.pull_requests = []
    const number = scenario === 'another-pr-and-base' ? 43 : 42
    const baseRef = number === 43 ? 'next' : 'main'
    const newMergeSha = 'e'.repeat(40)
    const fakePull = { ...pull, number, merge_commit_sha: newMergeSha, base: { ...pull.base, ref: baseRef, sha: staleSha } }
    const live = vi.fn(async (endpoint) => {
      if (endpoint === `/pulls/${number}`) {
        return fakePull
      }
      if (endpoint === `/git/ref/heads/${baseRef}`) {
        return { object: { sha: staleSha } }
      }
      if (endpoint === `/git/ref/pull/${number}/merge`) {
        return { ref: `refs/pull/${number}/merge`, object: { sha: newMergeSha } }
      }
      if (endpoint === `/git/commits/${newMergeSha}`) {
        return { sha: newMergeSha, parents: [{ sha: staleSha }, { sha: headSha }] }
      }
      if (endpoint.startsWith(`/pulls/${number}/files?`)) {
        return []
      }
      return get(endpoint)
    })
    Object.assign(report.context, { prNumber: number, baseRef, baseSha: staleSha, driverSha: newMergeSha, checkoutSha: newMergeSha })
    report.request = live
    await expect(publishNativePrReport(report)).rejects.toThrow('invocation proof')
    expect(live).not.toHaveBeenCalled()
    options.driverSha = newMergeSha
    options.event = { number, pull_request: fakePull }
    await expect(resolveNativePrContext(options, live)).rejects.toThrow('invocation proof')
    expect(live.mock.calls).toEqual([['/actions/runs/123']])
  })
})
