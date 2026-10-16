/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式必须按字面量核验。 */
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { projectPrContext, resolveNativePrContext, validateNativePrContext } from '../.github/scripts/native-pr-context.mjs'

const repository = 'example/project'
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const driverSha = 'c'.repeat(40)
const admissionPolicy = JSON.parse(await readFile(new URL('../.github/pr-admission.json', import.meta.url), 'utf8'))
const pull = { number: 42, state: 'open', merge_commit_sha: driverSha, head: { sha: headSha, ref: 'feature', repo: { full_name: 'contributor/project' } }, base: { sha: baseSha, ref: 'main', repo: { full_name: repository } } }
const profiles = {
  ci: { paths: [], baseBranches: [], checkoutMode: 'merge' },
  smoke: { paths: ['packages/**'], baseBranches: ['main'], checkoutMode: 'head' },
  excluded: { paths: [], baseBranches: ['release/**'], checkoutMode: 'merge' },
}

function fixture() {
  const state = { pull, files: [{ filename: 'docs/renamed.md', previous_filename: 'packages/old.ts' }], baseSha }
  const get = vi.fn(async (pathname) => {
    if (pathname === '/pulls/42') {
      return state.pull
    }
    if (pathname === '/git/ref/heads/main') {
      return { object: { sha: state.baseSha } }
    }
    if (pathname === `/git/commits/${driverSha}`) {
      return { sha: driverSha, parents: [{ sha: baseSha }, { sha: headSha }] }
    }
    if (pathname.includes('/files?')) {
      const page = Number(new URL(pathname, 'https://api.example.test').searchParams.get('page'))
      return state.files.slice((page - 1) * 100, page * 100)
    }
    throw new Error(`Unexpected request: ${pathname}`)
  })
  return { state, get, options: { repository, runId: 123, runAttempt: 1, driverSha, event: { number: 42, pull_request: pull }, profiles } }
}

describe('native PR approval context', () => {
  it('freezes fork HEAD, base and merge and shares one changed-files listing', async () => {
    const { options, get } = fixture()
    const context = await resolveNativePrContext(options, get)
    expect(context).toMatchObject({ event: 'pull_request', headSha, baseSha, driverSha, checkoutSha: driverSha, headRepository: 'contributor/project', selections: { ci: true, smoke: true, excluded: false } })
    expect(get.mock.calls.filter(([pathname]) => pathname.includes('/files?'))).toHaveLength(1)
    expect(projectPrContext(context, profiles.smoke, 'smoke')).toMatchObject({ checkoutMode: 'head', checkoutSha: headSha })
    expect(projectPrContext(context, profiles.excluded, 'excluded').shouldRun).toBe(false)
    expect(projectPrContext(context, profiles.ci, 'ci').checkoutSha).toBe(driverSha)
    expect(context.checkoutSha).toBe(driverSha)
  })

  it('refuses to retarget a waiting run after a new commit', async () => {
    const { options, get } = fixture()
    options.event = { number: 42, pull_request: { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } } }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('waiting for approval')
  })

  it('refuses a changed base and mismatched merge instead of running the wrong revision', async () => {
    const first = fixture()
    first.state.baseSha = 'd'.repeat(40)
    await expect(resolveNativePrContext(first.options, first.get)).rejects.toThrow('base snapshot is stale')
    const second = fixture()
    second.options.driverSha = 'd'.repeat(40)
    await expect(resolveNativePrContext(second.options, second.get)).rejects.toThrow('waiting for approval')
  })

  it('refuses movement while listing changed files before publishing shared selections', async () => {
    const { options, get, state } = fixture()
    const moving = async (pathname) => {
      const response = await get(pathname)
      if (pathname.includes('/files?')) {
        state.pull = { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } }
      }
      return response
    }
    await expect(resolveNativePrContext(options, moving)).rejects.toThrow('while selecting checks')
  })

  it('fails closed on missing profile selections and malformed native events', async () => {
    const { options, get } = fixture()
    await expect(resolveNativePrContext({ ...options, event: {} }, get)).rejects.toThrow('pull_request event')
    const context = await resolveNativePrContext(options, get)
    expect(() => projectPrContext(context, profiles.ci, 'unknown')).toThrow('Missing native PR profile')
  })

  it('keeps all path checks when the changed-files API reaches its truncation boundary', async () => {
    const { options, get, state } = fixture()
    state.files = Array.from({ length: 3000 }, (_, index) => ({ filename: `docs/page-${index}.md` }))
    expect((await resolveNativePrContext(options, get)).selections).toEqual({ ci: true, smoke: true, excluded: false })
  })

  it('authenticates native artifact identity separately from manual dispatch', async () => {
    const { options, get } = fixture()
    const context = await resolveNativePrContext(options, get)
    const run = { id: 123, event: 'pull_request', head_sha: headSha, pull_requests: [pull] }
    expect(validateNativePrContext(context, run, repository)).toBe(context)
    for (const change of [{ event: 'workflow_dispatch' }, { head_sha: driverSha }, { pull_requests: [] }]) {
      expect(() => validateNativePrContext(context, { ...run, ...change }, repository)).toThrow('Untrusted native PR context')
    }
  })
})

describe('native approval workflow graph', () => {
  const read = async name => parse(await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'))

  it('holds every validation behind exactly one protected approval with no checkout before approval', async () => {
    const workflow = await read('ci-pr.yml')
    expect(workflow.on).toEqual({ pull_request: { types: ['opened', 'synchronize', 'reopened'] }, pull_request_target: { types: ['closed'] } })
    expect(workflow.concurrency).toEqual({ 'group': 'pr-ci-${{ github.event.pull_request.number }}', 'cancel-in-progress': true })
    expect(workflow.permissions).toEqual({ 'contents': 'read', 'pull-requests': 'read', 'actions': 'read' })
    const { approval, plan, ...checks } = workflow.jobs
    expect(approval.environment).toBe(admissionPolicy.environment)
    expect(approval.if).toBe('github.event_name == \'pull_request\'')
    expect(approval.needs).toBeUndefined()
    expect(approval.steps).toHaveLength(1)
    expect(approval.steps[0].uses).toBeUndefined()
    expect(plan.needs).toBe('approval')
    expect(plan.steps.filter(step => step.uses?.startsWith('actions/upload-artifact@')).map(step => step.with.name)).toEqual(['pr-context'])
    const profiles = JSON.parse(await readFile(new URL('../.github/pr-checks.json', import.meta.url), 'utf8'))
    expect(Object.keys(checks)).toEqual(Object.keys(profiles))
    for (const [name, check] of Object.entries(checks)) {
      expect(check.needs).toBe('plan')
      expect(check.if).toContain(`selections['${name}']`)
      expect(check.with).toEqual({ pr_context: '${{ needs.plan.outputs.pr_context }}' })
      expect(check.secrets).toBeUndefined()
      const shared = await read(`validate-${name}.yml`)
      expect(shared.on.workflow_call.inputs.pr_context).toEqual({ type: 'string', required: true })
      expect(Object.values(shared.permissions).every(permission => permission === 'read')).toBe(true)
      expect(Object.values(shared.jobs).some(job => Object.values(job.permissions ?? {}).includes('write'))).toBe(false)
      const wrapper = await read(`${name}.yml`)
      expect(wrapper.jobs.validation.uses).toBe(check.uses)
      expect(wrapper.jobs['pr-context'].with.profile).toBe(name)
    }
    expect(checks['nightly-performance']).toBeUndefined()
  })

  it('projects frozen contexts without artifacts, status writes or API tokens', async () => {
    const shared = await read('reusable-frozen-pr-context.yml')
    expect(shared.permissions).toEqual({ contents: 'read' })
    const steps = shared.jobs.resolve.steps
    expect(steps.some(step => step.uses?.startsWith('actions/upload-artifact@'))).toBe(false)
    expect(steps.find(step => step.id === 'context').env).not.toHaveProperty('GITHUB_TOKEN')
  })

  it('isolates native performance feedback in the trusted completion reporter', async () => {
    const report = await read('ci-performance-comment.yml')
    expect(report.on.workflow_run.workflows).toContain('PR CI')
    const job = report.jobs['native-pr-report']
    expect(job.permissions).toEqual({ 'actions': 'read', 'contents': 'read', 'pull-requests': 'write' })
    expect(job.steps[0].with.ref).toBe('${{ github.event.repository.default_branch }}')
    const downloads = job.steps.filter(step => step.uses?.startsWith('actions/download-artifact@'))
    expect(downloads.map(step => step.with.path)).toEqual(['native-pr-artifacts/pr-context', 'native-pr-artifacts/performance-smoke-report', 'native-pr-artifacts/wevu-runtime-size-report'])
    const source = job.steps.find(step => step.id === 'source')
    expect(source.run).toBe('node .github/scripts/publish-native-pr-report.mjs resolve')
    expect(job.steps.indexOf(source)).toBeLessThan(job.steps.indexOf(downloads[0]))
    for (const download of downloads) {
      expect(download.if).toBe('steps.source.outputs.should_report == \'true\'')
      expect(download.with['run-id']).toBe('${{ steps.source.outputs.run_id }}')
    }
  })
})
