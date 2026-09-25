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
    expect(workflow.jobs.plan.if).toContain('github.event.repository.default_branch')
    expect(workflow.jobs.collect.strategy).toMatchObject({ 'fail-fast': false, 'max-parallel': 6 })
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
    ]) {
      const workflow = parse(await readFile(path.join(root, '.github/workflows', file!), 'utf8'))
      const setup = workflow.jobs[job!].steps.find((step: { uses?: string }) => step.uses?.startsWith('pnpm/action-setup@'))
      expect(setup.with?.version).toBeUndefined()
      expect(setup.with?.package_json_file ?? 'package.json').toBe(manifest)
    }
  })

  it('uses trusted workflow_run permissions and both source workflows', async () => {
    const workflow = parse(await readFile(path.join(root, '.github/workflows/ci-performance-comment.yml'), 'utf8'))
    expect(workflow.on.workflow_run.workflows).toEqual(['CI Performance', 'Wevu Runtime Size', 'Performance Smoke', 'Nightly Performance'])
    expect(workflow.permissions).toMatchObject({ 'actions': 'read', 'contents': 'read', 'pull-requests': 'write' })
    expect((workflow.jobs.comment.steps as Array<{ name?: string }>).some(step => step.name === 'Check out trusted reporting scripts')).toBe(true)
    const checkout = workflow.jobs.comment.steps.find((step: { name?: string }) => step.name === 'Check out trusted reporting scripts')
    expect(checkout.with.ref).toContain('github.event.repository.default_branch')
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
