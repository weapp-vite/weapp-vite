import { readFile } from 'node:fs/promises'
import { Script } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const read = async name => parse(await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'))

// 这些准入条件仅使用与 JS 同义的比较和布尔运算，直接执行仓库 YAML 中的条件。
function condition(expression, github, extra = {}) {
  return new Script(expression.replace(/^\$\{\{\s*|\s*\}\}$/gu, '')).runInNewContext({
    github,
    fromJSON: JSON.parse,
    contains: (values, value) => values.includes(value),
    ...extra,
  }, { timeout: 100 })
}

describe('PR resource admission before allocating runners', () => {
  it.each(['failure', 'cancelled', 'timed_out', 'action_required', 'skipped', 'neutral', 'stale', 'startup_failure'])('starts no report jobs for a native PR CI %s event', async (conclusion) => {
    const workflow = await read('ci-performance-comment.yml')
    const github = { event_name: 'workflow_run', ref_name: 'main', ref_type: 'branch', event: { repository: { default_branch: 'main' }, workflow_run: { name: 'PR CI', event: 'pull_request', conclusion } } }
    expect(Object.values(workflow.jobs).filter(job => condition(job.if, github))).toEqual([])
  })

  it('runs one automatic report for success and allows explicit default-branch recovery', async () => {
    const workflow = await read('ci-performance-comment.yml')
    expect(workflow.on.workflow_dispatch.inputs['run-id']).toMatchObject({ required: true, type: 'string' })
    const event = { repository: { default_branch: 'main' }, workflow_run: { name: 'PR CI', event: 'pull_request', conclusion: 'success' } }
    const jobs = github => Object.entries(workflow.jobs).filter(([, job]) => condition(job.if, github)).map(([name]) => name)
    expect(jobs({ event_name: 'workflow_run', ref_name: 'main', ref_type: 'branch', event })).toEqual(['native-pr-report'])
    expect(jobs({ event_name: 'workflow_dispatch', ref_name: 'main', ref_type: 'branch', event: { ...event, workflow_run: {} } })).toEqual(['native-pr-report'])
    expect(jobs({ event_name: 'workflow_dispatch', ref_name: 'feature', ref_type: 'branch', event: { ...event, workflow_run: {} } })).toEqual([])
    expect(jobs({ event_name: 'workflow_dispatch', ref_name: 'main', ref_type: 'tag', event: { ...event, workflow_run: {} } })).toEqual([])
  })

  it('uses closing a PR only to cancel its concurrency group with every job skipped', async () => {
    const workflow = await read('ci-pr.yml')
    expect(workflow.on.pull_request_target).toEqual({ types: ['closed'] })
    const github = { event_name: 'pull_request_target', event: { action: 'closed' } }
    expect(condition(workflow.jobs.approval.if, github)).toBe(false)
    expect(workflow.jobs.plan.needs).toBe('approval')
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (name !== 'approval' && name !== 'plan') {
        expect(job.needs).toBe('plan')
      }
      expect(job.if ?? '').not.toMatch(/always\(|cancelled\(|failure\(/u)
    }
    const report = await read('ci-performance-comment.yml')
    const closingRun = { event_name: 'workflow_run', event: { workflow_run: { name: 'PR CI', event: 'pull_request_target', conclusion: 'success' } } }
    expect(condition(report.jobs['native-pr-report'].if, closingRun)).toBe(false)
  })
})

describe('cancelled routine checks release runners without extra reports', () => {
  it('skips evidence uploads after cancellation while retaining ordinary failure evidence', async () => {
    const profiles = JSON.parse(await readFile(new URL('../.github/pr-checks.json', import.meta.url), 'utf8'))
    const names = [...Object.keys(profiles).map(name => `validate-${name}.yml`), 'reusable-node-command.yml']
    const inputs = { artifact_name: 'report', artifact_path: 'report.json' }
    const steps = { scope: { outputs: { needed: 'true' } } }
    let checked = 0
    for (const name of names) {
      const workflow = await read(name)
      for (const job of Object.values(workflow.jobs)) {
        for (const step of job.steps ?? []) {
          if (!step.uses?.startsWith('actions/upload-artifact@') || !step.if) {
            continue
          }
          expect(condition(step.if, {}, { cancelled: () => true, success: () => false, inputs, steps })).toBe(false)
          if (step.if.includes('success()')) {
            continue
          }
          expect(step.if).toContain('!cancelled()')
          expect(condition(step.if, {}, { cancelled: () => false, inputs, steps })).toBe(true)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(5)
    expect((await read('validate-ci-create-weapp-vite.yml')).jobs.report.if).toContain('!cancelled()')
    expect((await read('nightly-performance.yml')).jobs.collect.steps.at(-1).if).toBe('always()')
  })
})
