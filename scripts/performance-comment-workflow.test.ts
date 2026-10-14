import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = path.resolve(import.meta.dirname, '..')

describe('performance reporting workflows', () => {
  it('keeps PR feedback on one read-only Ubuntu smoke with a hard deadline', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci-performance.yml'), 'utf8'))
    expect(Object.keys(workflow.on)).toEqual(['pull_request'])
    expect(Object.keys(workflow.jobs)).toEqual(['smoke'])
    expect(workflow.jobs.smoke['runs-on']).toBe('ubuntu-latest')
    expect(workflow.jobs.smoke['timeout-minutes']).toBe(15)
    expect(workflow.permissions).toEqual({ 'contents': 'read', 'pull-requests': 'read' })
    expect(workflow.jobs.smoke.steps.some((step: { run?: string }) => step.run?.includes('full.ts'))).toBe(false)
    expect(workflow.jobs.smoke.steps.find((step: { name?: string }) => step.name === 'Run correctness smoke').if).toContain('steps.scope.outputs.needed')
    expect(workflow.jobs.smoke.steps.find((step: { name?: string }) => step.name === 'Check collector contracts').run).toContain('--config scripts/vitest.config.mjs')
  })

  it('isolates scheduled full collection, bounds concurrency and always retains failed evidence', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/nightly-performance.yml'), 'utf8'))
    expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch'])
    expect(workflow.on.schedule[0].cron).toBe('35 19 * * *')
    expect(workflow.on.workflow_dispatch.inputs['main-only']).toMatchObject({ type: 'boolean', default: false })
    expect(workflow.jobs.plan.steps.find((step: { id?: string }) => step.id === 'plan').env.MAIN_ONLY).toContain('inputs.main-only')
    expect(workflow.jobs.plan.if).toContain('github.event.repository.default_branch')
    expect(workflow.jobs.collect.strategy).toMatchObject({ 'fail-fast': false, 'max-parallel': 27 })
    expect(workflow.jobs.collect['timeout-minutes']).toBe(180)
    expect(workflow.jobs.collect.permissions).toEqual({ contents: 'read' })
    const steps = workflow.jobs.collect.steps
    expect(steps.filter((s: { uses?: string }) => s.uses?.startsWith('actions/checkout')).every((s: { with: Record<string, unknown> }) => s.with['persist-credentials'] === false)).toBe(true)
    expect(steps.at(-1).if).toBe('always()')
    expect(steps.at(-1).with['if-no-files-found']).toBe('error')
    expect(workflow.jobs.summary.if).toContain('always()')
  })

  it('resolves pnpm from the checked-out packageManager instead of a second version pin', async () => {
    for (const [file, job, manifest] of [
      ['ci-performance.yml', 'smoke', 'package.json'],
      ['nightly-performance.yml', 'collect', 'driver/package.json'],
      ['candidate-performance.yml', 'collect', 'driver/package.json'],
      ['wevu-runtime-size.yml', 'measure', 'head/package.json'],
    ]) {
      const workflow = parse(await readFile(path.join(root, '.github/workflows', file!), 'utf8'))
      const setup = workflow.jobs[job!].steps.find((step: { uses?: string }) => step.uses?.startsWith('pnpm/action-setup@'))
      expect(setup.with?.version).toBeUndefined()
      expect(setup.with?.package_json_file ?? 'package.json').toBe(manifest)
    }
  })

  it('collects an explicitly selected candidate once and keeps tokens outside measured jobs', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/candidate-performance.yml'), 'utf8'))
    const nightly = parse(await readFile(path.join(root, '.github/workflows/nightly-performance.yml'), 'utf8'))
    expect(workflow.name).toBe('Candidate Performance')
    expect(Object.keys(workflow.on).sort()).toEqual(['push', 'workflow_dispatch'])
    expect(workflow.on.push.tags).toEqual(['codex/performance-candidate/*'])
    expect(workflow.on.workflow_dispatch.inputs['candidate-sha']).toMatchObject({ type: 'string', required: true })
    expect(workflow.concurrency).toEqual(nightly.concurrency)
    expect(workflow.concurrency['cancel-in-progress']).toBe(false)
    expect(workflow.permissions).toEqual({ contents: 'read' })
    const plan = workflow.jobs.plan
    expect(plan.permissions).toEqual({ contents: 'read', statuses: 'write' })
    const freeze = plan.steps.find((step: { id?: string }) => step.id === 'plan')
    expect(freeze.env.CANDIDATE_SHA).toContain('inputs.candidate-sha || github.sha')
    expect(freeze.run).toBe('node scripts/performanceGate/candidate.mjs plan')
    const collect = workflow.jobs.collect
    expect(collect.if).toContain('github.run_attempt == 1')
    expect(collect.strategy).toMatchObject({ 'fail-fast': false, 'max-parallel': 27 })
    expect(collect.permissions).toEqual({ contents: 'read' })
    expect(collect.steps.some((step: { env?: Record<string, unknown> }) => Object.keys(step.env ?? {}).some(key => /TOKEN|SECRET/.test(key)))).toBe(false)
    for (const job of Object.values(workflow.jobs) as Array<{ steps: Array<{ uses?: string, with?: Record<string, unknown> }> }>) {
      const checkouts = job.steps.filter(step => step.uses?.startsWith('actions/checkout@'))
      expect(checkouts.every(step => step.with?.['persist-credentials'] === false)).toBe(true)
      expect(checkouts.every(step => /^\$\{\{ (?:github\.sha|matrix\.(?:headSha|baselineSha)) \}\}$/.test(String(step.with?.ref)))).toBe(true)
    }
    expect(collect.steps.at(-1)).toMatchObject({ if: 'always()', with: { 'if-no-files-found': 'error', 'retention-days': 90 } })
    const summary = workflow.jobs.summary
    expect(summary.if).toBe('always() && needs.plan.result == \'success\'')
    expect(summary.permissions).toEqual({ actions: 'read', contents: 'read', statuses: 'write' })
    expect(summary.steps.find((step: { run?: string }) => step.run?.endsWith('aggregate.mjs'))).toBeDefined()
    const restore = summary.steps.find((step: { name?: string }) => step.name === 'Restore original evidence for a reused success')
    expect(restore.if).toBe('needs.plan.outputs.previous_run_id != \'\'')
    expect(restore.with).toMatchObject({ pattern: 'performance-*', path: 'performance-artifacts/previous' })
    expect(restore.with['run-id']).toContain('needs.plan.outputs.previous_run_id')
    expect(restore.with['github-token']).toContain('secrets.GITHUB_TOKEN')
    expect(restore.with['merge-multiple'] ?? false).toBe(false)
    expect(summary.steps.find((step: { run?: string }) => step.run?.endsWith('candidate.mjs publish')).if).toBe('always()')
    expect(summary.steps.at(-1)).toMatchObject({ if: 'always()', with: { 'if-no-files-found': 'error', 'retention-days': 90 } })
  })

  it('uses trusted workflow_run permissions and both source workflows', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci-performance-comment.yml'), 'utf8'))
    expect(workflow.on.workflow_run.workflows).toEqual(['CI Performance', 'Wevu Runtime Size', 'Performance Smoke', 'Nightly Performance'])
    expect(workflow.permissions).toMatchObject({ 'actions': 'read', 'contents': 'read', 'pull-requests': 'write' })
    expect((workflow.jobs.comment.steps as Array<{ name?: string }>).some(step => step.name === 'Check out trusted reporting scripts')).toBe(true)
    const checkout = workflow.jobs.comment.steps.find((step: { name?: string }) => step.name === 'Check out trusted reporting scripts')
    expect(checkout.with.ref).toContain('github.event.repository.default_branch')
  })

  it('downloads optional smoke evidence into its own stable directory', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci-performance-comment.yml'), 'utf8'))
    const downloads = workflow.jobs['report-v2'].steps.filter((step: { uses?: string }) => step.uses?.startsWith('actions/download-artifact@'))
    expect(downloads).toHaveLength(2)
    const smoke = downloads.find((step: { with: { pattern: string } }) => step.with.pattern === 'performance-smoke-report')
    expect(smoke.if).toBe('github.event.workflow_run.name == \'Performance Smoke\'')
    expect(smoke.with).toMatchObject({
      path: 'performance-artifacts/performance-smoke-report',
    })
    expect(smoke.with['run-id']).toContain('github.event.workflow_run.id')
    // name 会在缺失 artifact 时失败，无法报告无需冒烟和采集失败的运行。
    expect(smoke.with.name).toBeUndefined()
    const nightly = downloads.find((step: { with: { pattern: string } }) => step.with.pattern === 'performance-*')
    expect(nightly.if).toBe('github.event.workflow_run.name == \'Nightly Performance\'')
    expect(nightly.with.path).toBe('performance-artifacts')
    expect(nightly.with['merge-multiple'] ?? false).toBe(false)
  })

  it('publishes the complete matrix and a compatibility artifact from the same measurement', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/wevu-runtime-size.yml'), 'utf8'))
    const measure = workflow.jobs.measure.steps.find((step: { name?: string }) => step.name === 'Measure head and baseline')
    expect(measure.run).toContain('--root=../baseline')
    expect(measure.run).toContain('--artifact-json=../runtime-size-artifact/report-full.json')
    expect(measure.run).toContain('--legacy-artifact-json=../runtime-size-artifact/report.json')
    expect(measure.run).toContain('--github-summary')
    expect(measure.run).toContain('--check')
  })
})
