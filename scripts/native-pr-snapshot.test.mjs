import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { resolveNativePrContext } from '../.github/scripts/native-pr-context.mjs'

const repository = 'example/project'
const base = 'a'.repeat(40)
const head = 'b'.repeat(40)
const driver = 'c'.repeat(40)
const advanced = 'd'.repeat(40)
const profiles = {
  compiler: { baseBranches: [], paths: ['packages/compiler/**'], checkoutMode: 'merge' },
  website: { baseBranches: [], paths: ['website/**'], checkoutMode: 'merge' },
}

function fixture() {
  const pull = { number: 42, state: 'open', merge_commit_sha: advanced, head: { sha: head, ref: 'topic', repo: { id: 2, full_name: 'contributor/project' } }, base: { sha: advanced, ref: 'main', repo: { id: 1, full_name: repository } } }
  const run = { id: 123, run_attempt: 1, event: 'pull_request', path: '.github/workflows/ci-pr.yml', head_sha: head, head_branch: 'topic', repository: pull.base.repo, head_repository: pull.head.repo, pull_requests: [structuredClone(pull)], referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${driver}`, sha: driver, ref: 'refs/pull/42/merge' }] }
  const state = { pull, run, merge: { sha: driver, parents: [{ sha: base }, { sha: head }] }, comparison: { base_commit: { sha: base }, files: [{ filename: 'packages/compiler/index.ts', status: 'modified' }] } }
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, draft: false, id: 'snapshot-contract', pullRequests: [99], baseBranch: 'main', profiles: ['compiler'] }))
  const blob = { type: 'file', path: '.github/verification-workload.json', encoding: 'base64', content: bytes.toString('base64'), sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }
  const get = async (endpoint) => {
    if (endpoint === '/actions/runs/123') {
      return structuredClone(state.run)
    }
    if (endpoint === '/pulls/42') {
      return structuredClone(state.pull)
    }
    if (endpoint === `/git/commits/${driver}`) {
      return structuredClone(state.merge)
    }
    if (endpoint === `/compare/${base}...${head}?per_page=100`) {
      return structuredClone(state.comparison)
    }
    if (endpoint === `/contents/.github/verification-workload.json?ref=${driver}`) {
      return structuredClone(blob)
    }
    throw new Error(`Unexpected mutable or unbound endpoint: ${endpoint}`)
  }
  return { state, get, options: { repository, runId: 123, runAttempt: 1, driverSha: driver, event: { number: 42, pull_request: structuredClone(pull) }, profiles } }
}

describe('approved native PR snapshot', () => {
  it('runs the approved merge and its compiler changes after live merge metadata advances', async () => {
    const { options, get } = fixture()
    await expect(resolveNativePrContext(options, get)).resolves.toMatchObject({ baseSha: base, headSha: head, driverSha: driver, checkoutSha: driver, selections: { compiler: true, website: false }, documentationOnly: false })
  })

  it('does not replace the approved target when merge metadata changes during selection', async () => {
    const { options, get, state } = fixture()
    const moving = async (endpoint) => {
      const result = await get(endpoint)
      if (endpoint.startsWith('/compare/')) {
        state.pull.base.sha = 'e'.repeat(40)
        state.pull.merge_commit_sha = 'f'.repeat(40)
      }
      return result
    }
    await expect(resolveNativePrContext(options, moving)).resolves.toMatchObject({ baseSha: base, checkoutSha: driver, selections: { compiler: true, website: false } })
  })

  it('still rejects a new head appearing after immutable file selection', async () => {
    const { options, get, state } = fixture()
    const moving = async (endpoint) => {
      const result = await get(endpoint)
      if (endpoint.startsWith('/compare/')) {
        state.pull.head.sha = advanced
      }
      return result
    }
    await expect(resolveNativePrContext(options, moving)).rejects.toThrow('while selecting checks')
  })

  it.each(['missing', 'extra', 'reversed', 'wrong-head', 'bad-base', 'wrong-object'])('rejects invalid approved merge proof: %s', async (kind) => {
    const { options, get, state } = fixture()
    if (kind === 'missing') {
      state.merge.parents.pop()
    }
    if (kind === 'extra') {
      state.merge.parents.push({ sha: advanced })
    }
    if (kind === 'reversed') {
      state.merge.parents.reverse()
    }
    if (kind === 'wrong-head') {
      state.merge.parents[1].sha = advanced
    }
    if (kind === 'bad-base') {
      state.merge.parents[0].sha = 'invalid'
    }
    if (kind === 'wrong-object') {
      state.merge.sha = advanced
    }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('snapshot merge parent identity')
  })

  it.each([299, 300])('preserves complete checks at the immutable comparison cap: %s files', async (count) => {
    const { options, get, state } = fixture()
    state.comparison.files = Array.from({ length: count }, (_, index) => ({ filename: `README.locale-${index}.md`, status: 'modified' }))
    const context = await resolveNativePrContext(options, get)
    expect(context.documentationOnly).toBe(count < 300)
    expect(context.selections).toEqual(count < 300 ? { compiler: false, website: false } : { compiler: true, website: true })
  })

  it('does not omit an unknown old path when rename metadata is incomplete', async () => {
    const { options, get, state } = fixture()
    state.comparison.files = [{ filename: 'README.md', status: 'renamed' }]
    await expect(resolveNativePrContext(options, get)).resolves.toMatchObject({ documentationOnly: false, selections: { compiler: true, website: true } })
  })

  it.each(['wrong-base', 'missing-files', 'missing-name'])('rejects unbound comparison data: %s', async (kind) => {
    const { options, get, state } = fixture()
    if (kind === 'wrong-base') {
      state.comparison.base_commit.sha = advanced
    }
    if (kind === 'missing-files') {
      delete state.comparison.files
    }
    if (kind === 'missing-name') {
      delete state.comparison.files[0].filename
    }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('snapshot changed-files response')
  })
})
