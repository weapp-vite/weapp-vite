/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式必须按字面量核验。 */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { assertPrTopology, projectPrContext, resolveNativePrContext, validateNativePrContext } from '../.github/scripts/native-pr-context.mjs'
import { NATIVE_PR_WORKLOAD_PATH, readNativePrWorkload, verificationTopologyForAttempt } from '../.github/scripts/native-pr-workload.mjs'

const repository = 'example/project'
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const driverSha = 'c'.repeat(40)
const admissionPolicy = JSON.parse(await readFile(new URL('../.github/pr-admission.json', import.meta.url), 'utf8'))
const pull = { number: 42, state: 'open', merge_commit_sha: driverSha, head: { sha: headSha, ref: 'feature', repo: { id: 2, full_name: 'contributor/project' } }, base: { sha: baseSha, ref: 'main', repo: { id: 1, full_name: repository } } }
const profiles = {
  ci: { paths: [], baseBranches: [], checkoutMode: 'merge' },
  smoke: { paths: ['packages/**'], baseBranches: ['main'], checkoutMode: 'head' },
  excluded: { paths: [], baseBranches: ['release/**'], checkoutMode: 'merge' },
}
const workload = { schemaVersion: 1, draft: false, id: 'verification-test-v1', pullRequests: [1239, 1242], baseBranch: 'main', profiles: ['smoke'] }

function workloadBlob(value) {
  const bytes = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
  return { type: 'file', path: NATIVE_PR_WORKLOAD_PATH, encoding: 'base64', content: bytes.toString('base64'), sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }
}

function fixture() {
  const run = { id: 123, run_attempt: 1, event: 'pull_request', path: '.github/workflows/ci-pr.yml', head_sha: headSha, head_branch: pull.head.ref, repository: pull.base.repo, head_repository: pull.head.repo, pull_requests: [pull] }
  run.referenced_workflows = [{ path: `${repository}/.github/workflows/validate-ci.yml@${driverSha}`, sha: driverSha, ref: 'refs/pull/42/merge' }]
  const state = { run, pull, files: [{ filename: 'docs/renamed.md', previous_filename: 'packages/old.ts' }], baseSha, workload }
  const get = vi.fn(async (pathname) => {
    if (pathname === '/actions/runs/123') {
      return state.run
    }
    if (pathname === '/git/ref/pull/42/merge') {
      return { ref: 'refs/pull/42/merge', object: { sha: driverSha } }
    }
    if (pathname === '/pulls/42') {
      return state.pull
    }
    if (pathname === `/git/ref/heads/${encodeURIComponent(state.pull.base.ref)}`) {
      return { object: { sha: state.baseSha } }
    }
    if (pathname === `/contents/${NATIVE_PR_WORKLOAD_PATH}?ref=${driverSha}`) {
      return workloadBlob(state.workload)
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
  return { state, get, run, options: { repository, runId: 123, runAttempt: 1, driverSha, event: { number: 42, pull_request: pull }, profiles } }
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

  it('routes root policy documentation to the frozen lint paths without scheduling product checks', async () => {
    const { options, get, state } = fixture()
    state.files = [{ filename: 'CONTRIBUTING.md', status: 'modified' }]
    const context = await resolveNativePrContext(options, get)
    expect(context).toMatchObject({ documentationOnly: true, documentationPaths: ['CONTRIBUTING.md'], documentationChecks: [], verificationTopology: 'optimized-v1', selections: { ci: false, smoke: false, excluded: false } })
    state.files = [{ filename: 'CONTRIBUTING.md', previous_filename: 'packages/source.ts', status: 'renamed' }]
    expect((await resolveNativePrContext(options, get)).documentationOnly).toBe(false)
    state.files = [{ filename: 'CONTRIBUTING.md', status: 'removed' }]
    expect(await resolveNativePrContext(options, get)).toMatchObject({ documentationOnly: true, documentationPaths: [] })
    state.files = [{ filename: 'AGENTS.md', status: 'removed' }]
    expect(await resolveNativePrContext(options, get)).toMatchObject({ documentationOnly: true, documentationPaths: [], documentationChecks: ['agents', 'skills'] })
    state.files = [{ filename: 'CONTRIBUTING.md', previous_filename: 'AGENTS.md', status: 'renamed' }]
    expect(await resolveNativePrContext(options, get)).toMatchObject({ documentationOnly: true, documentationPaths: ['CONTRIBUTING.md'], documentationChecks: ['agents', 'skills'] })
  })

  it('freezes an explicitly reviewed v2 topology only for the listed workload PRs', async () => {
    const { options, get, state } = fixture()
    state.workload = { ...workload, verificationTopology: 'optimized-v2' }
    expect((await resolveNativePrContext(options, get)).verificationTopology).toBe('optimized-v1')
    state.workload.pullRequests = [42]
    state.files = [{ filename: 'CONTRIBUTING.md', status: 'modified' }]
    const context = await resolveNativePrContext(options, get)
    expect(context).toMatchObject({ documentationOnly: false, verificationTopology: 'optimized-v2', selections: { ci: true, smoke: true, excluded: false } })
    expect(context.benchmarkWorkload.manifest.sha256).toBe(createHash('sha256').update(JSON.stringify(state.workload)).digest('hex'))
  })

  it('chooses a reviewed topology by the actual rerun attempt without changing source or manifest bytes', async () => {
    const { options, get, state } = fixture()
    state.workload = { ...workload, pullRequests: [42], verificationTopology: 'optimized-v1', verificationTopologyByAttempt: { 1: 'optimized-v1', 2: 'optimized-v2', 4: 'optimized-v2' } }
    const first = await resolveNativePrContext(options, get)
    state.run.run_attempt = 2
    const second = await resolveNativePrContext({ ...options, runAttempt: 2 }, get)
    expect(first.verificationTopology).toBe('optimized-v1')
    expect(second.verificationTopology).toBe('optimized-v2')
    expect(first.driverSha).toBe(second.driverSha)
    expect(first.benchmarkWorkload.manifest).toEqual(second.benchmarkWorkload.manifest)
    expect(verificationTopologyForAttempt(state.workload, 3)).toBe('optimized-v1')
    expect(() => verificationTopologyForAttempt(state.workload, 0)).toThrow('attempt')
    expect(verificationTopologyForAttempt({ verificationTopologyByAttempt: { 2: 'optimized-v2' } }, 1)).toBe('optimized-v1')
    state.workload.pullRequests = [99]
    expect((await resolveNativePrContext({ ...options, runAttempt: 2 }, get)).verificationTopology).toBe('optimized-v1')
  })

  it('refuses a downstream topology that differs from the approved native context', async () => {
    const { options, get, state } = fixture()
    state.workload = { ...workload, verificationTopology: 'optimized-v2', pullRequests: [42] }
    const context = await resolveNativePrContext(options, get)
    expect(() => assertPrTopology(context, 'optimized-v1')).toThrow('topology mismatch')
    expect(() => assertPrTopology(context, 'optimized-v2')).not.toThrow()
    expect(() => assertPrTopology(context, 'unknown')).toThrow('Unsupported')
  })

  it('refuses to retarget a waiting run after a new commit', async () => {
    const { options, get } = fixture()
    options.event = { number: 42, pull_request: { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } } }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow(/waiting for approval|run identity/u)
  })

  it('refuses a changed base and mismatched merge instead of running the wrong revision', async () => {
    const first = fixture()
    first.state.baseSha = 'd'.repeat(40)
    await expect(resolveNativePrContext(first.options, first.get)).rejects.toThrow('merge candidate does not match')
    const second = fixture()
    second.options.driverSha = 'd'.repeat(40)
    await expect(resolveNativePrContext(second.options, second.get)).rejects.toThrow('invocation proof')
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
    const { options, get, run } = fixture()
    const context = await resolveNativePrContext(options, get)
    expect(validateNativePrContext(context, run, repository)).toBe(context)
    for (const change of [{ event: 'workflow_dispatch' }, { head_sha: driverSha }, { pull_requests: [] }]) {
      expect(() => validateNativePrContext(context, { ...run, ...change }, repository)).toThrow(/Untrusted native PR/u)
    }
  })

  it('keeps ordinary PR selections unchanged and adds only explicitly approved workload profiles', async () => {
    const { options, get, state } = fixture()
    state.files = [{ filename: 'docs/guide.md' }]
    const ordinary = await resolveNativePrContext(options, get)
    expect(ordinary).not.toHaveProperty('benchmarkWorkload')
    expect(ordinary.pathSelections).toEqual(ordinary.selections)
    state.workload = { ...workload, pullRequests: [42] }
    const active = await resolveNativePrContext(options, get)
    expect(active.pathSelections).toEqual({ ci: true, smoke: false, excluded: false })
    expect(active.selections).toEqual({ ci: true, smoke: true, excluded: false })
    expect(active.selectionSources).toEqual({ ci: 'path', smoke: 'workload', excluded: 'skipped' })
    expect(active.benchmarkWorkload).toMatchObject({ id: workload.id, baseBranch: 'main', profiles: ['smoke'], manifest: { path: NATIVE_PR_WORKLOAD_PATH, blobSha: workloadBlob(state.workload).sha } })
    expect(active.benchmarkWorkload.manifest.sha256).toBe(createHash('sha256').update(JSON.stringify(state.workload)).digest('hex'))
  })

  it('records both selection sources and freezes manifest bytes before the final HEAD guard', async () => {
    const { options, get, state } = fixture()
    state.workload = { ...workload, pullRequests: [42] }
    const context = await resolveNativePrContext(options, get)
    expect(context.selectionSources.smoke).toBe('path+workload')
    expect(get).toHaveBeenCalledWith(`/contents/${NATIVE_PR_WORKLOAD_PATH}?ref=${driverSha}`)
    const moving = async (pathname) => {
      const result = await get(pathname)
      if (pathname.startsWith('/contents/')) {
        state.pull = { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } }
      }
      return result
    }
    await expect(resolveNativePrContext(options, moving)).rejects.toThrow('while selecting checks')
  })

  it('requires retargeting active PRs instead of silently dropping incompatible branch checks', async () => {
    const { options, get, state } = fixture()
    state.workload = { ...workload, pullRequests: [42], baseBranch: 'next' }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('requires base next; retarget')
    state.workload = { ...workload, pullRequests: [42], profiles: ['excluded'] }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('profile excluded does not apply to base main; retarget')
  })

  it.each([
    { draft: true },
    { verificationTopology: 'unknown-v1' },
    ...[{}, [], null, { 0: 'optimized-v2' }, { '01': 'optimized-v2' }, { 1: 'legacy-v1' }, { '-1': 'optimized-v2' }, { 1.5: 'optimized-v2' }, { 9007199254740992: 'optimized-v2' }].map(verificationTopologyByAttempt => ({ verificationTopologyByAttempt })),
    { id: '' },
    { unexpected: true },
    { baseBranch: '*' },
    { pullRequests: [] },
    { pullRequests: [42, 42] },
    { pullRequests: [0] },
    { profiles: [] },
    { profiles: ['unknown'] },
    { profiles: ['smoke', 'smoke'] },
  ])('rejects malformed workload policy %j before scheduling checks', async (change) => {
    const { options, get, state } = fixture()
    state.workload = { ...workload, ...change }
    await expect(resolveNativePrContext(options, get)).rejects.toThrow('Invalid benchmark workload manifest')
  })

  it('rejects malformed JSON and mismatched immutable blob bytes', async () => {
    await expect(readNativePrWorkload(driverSha, profiles, async () => workloadBlob('{'))).rejects.toThrow()
    const blob = workloadBlob(workload)
    await expect(readNativePrWorkload(driverSha, profiles, async () => ({ ...blob, sha: 'd'.repeat(40) }))).rejects.toThrow('blob identity mismatch')
    await expect(readNativePrWorkload(driverSha, profiles, async () => ({ ...blob, content: `${blob.content}!` }))).rejects.toThrow('Invalid benchmark workload blob')
  })

  it('hashes original manifest bytes including indentation and CRLF instead of reserializing JSON', async () => {
    const source = `${JSON.stringify(workload, null, 2).replaceAll('\n', '\r\n')}\r\n`
    const receipt = await readNativePrWorkload(driverSha, profiles, async () => workloadBlob(source))
    expect(receipt.manifest.sha256).toBe(createHash('sha256').update(source).digest('hex'))
    expect(receipt.manifest.sha256).not.toBe(createHash('sha256').update(JSON.stringify(workload)).digest('hex'))
  })

  it('keeps the reviewed repository workload exact instead of automatically including future profiles', async () => {
    const actual = JSON.parse(await readFile(new URL(`../${NATIVE_PR_WORKLOAD_PATH}`, import.meta.url), 'utf8'))
    const configured = JSON.parse(await readFile(new URL('../.github/pr-checks.json', import.meta.url), 'utf8'))
    expect(actual).toEqual({ schemaVersion: 1, draft: false, id: 'verification-speedup-v1', pullRequests: [1239, 1242], baseBranch: 'main', profiles: Object.keys(configured) })
  })
})

describe('native approval workflow graph', () => {
  const read = async name => parse(await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'))

  it('holds every validation behind exactly one protected approval with no checkout before approval', async () => {
    const workflow = await read('ci-pr.yml')
    expect(workflow.on).toEqual({ pull_request: { types: ['opened', 'synchronize', 'reopened'] }, pull_request_target: { types: ['closed'] } })
    expect(workflow.concurrency).toEqual({ 'group': 'pr-ci-${{ github.event.pull_request.number }}', 'cancel-in-progress': true })
    expect(workflow.permissions).toEqual({ 'contents': 'read', 'pull-requests': 'read', 'actions': 'read' })
    const { approval, plan, documentation, ...checks } = workflow.jobs
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
      expect(check.with).toEqual({ pr_context: '${{ needs.plan.outputs.pr_context }}', verification_topology: '${{ fromJSON(needs.plan.outputs.pr_context).verificationTopology }}' })
      expect(check.secrets).toBeUndefined()
      const shared = await read(`validate-${name}.yml`)
      expect(shared.on.workflow_call.inputs.pr_context).toEqual({ type: 'string', required: true })
      expect(Object.values(shared.permissions).every(permission => permission === 'read')).toBe(true)
      expect(Object.values(shared.jobs).some(job => Object.values(job.permissions ?? {}).includes('write'))).toBe(false)
      const wrapper = await read(`${name}.yml`)
      expect(wrapper.jobs.validation.uses).toBe(check.uses)
      expect(wrapper.jobs['pr-context'].with.profile).toBe(name)
      if (profiles[name].paths.length) {
        expect(profiles[name].paths).toEqual(expect.arrayContaining(['.github/scripts/native-pr-workload.mjs', NATIVE_PR_WORKLOAD_PATH]))
      }
    }
    expect(checks['nightly-performance']).toBeUndefined()
    expect(documentation.needs).toBe('plan')
    expect(documentation.if).toBe('${{ fromJSON(needs.plan.outputs.pr_context).documentationOnly }}')
    const install = documentation.steps.find(step => step.uses === './.github/actions/install-workspace-deps')
    expect(install.with['ignore-scripts']).toBe('true')
    expect(documentation.steps.find(step => step.uses === './.github/actions/verify-frozen-job-context').with['verification-topology']).toBe('${{ fromJSON(needs.plan.outputs.pr_context).verificationTopology }}')
    expect(documentation.steps.at(-1).run).toBe('node .github/scripts/lint-frozen-documentation.mjs')
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
