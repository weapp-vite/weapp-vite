import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workflows = [
  'ci.yml',
  'ci-policy.yml',
  'ci-e2e.yml',
  'ci-create-weapp-vite.yml',
  'ci-acceptance-http.yml',
  'ci-acceptance.yml',
  'ci-dimina.yml',
  'ci-vite-host-consumer.yml',
  'ci-vscode-extension.yml',
  'ci-tutorial-e2e.yml',
  'deploy-website.yml',
  'native-addon-correctness.yml',
  'ci-performance.yml',
  'wevu-runtime-size.yml',
]
const workflowRoot = path.resolve(import.meta.dirname, '../.github/workflows')
const expression = value => `$${'{{'} ${value} }}`
const readWorkflow = async name => parse(await readFile(path.join(workflowRoot, name), 'utf8'))

describe('manual PR workflow entry points', () => {
  it('has no automatic PR event entry in any workflow', async () => {
    for (const name of await readdir(workflowRoot)) {
      if (!name.endsWith('.yml')) {
        continue
      }
      const workflow = await readWorkflow(name)
      expect(workflow.on, name).not.toHaveProperty('pull_request')
      expect(workflow.on, name).not.toHaveProperty('pull_request_target')
    }
  })

  it.each(workflows)('%s resolves an explicit PR before running its checks', async (name) => {
    const workflow = await readWorkflow(name)
    expect(workflow.on.workflow_dispatch.inputs['pr-number']).toMatchObject({ type: 'string', required: false })
    expect(workflow.permissions['pull-requests']).toBe('read')
    expect(workflow.jobs['pr-context']).toMatchObject({
      uses: './.github/workflows/reusable-pr-context.yml',
      with: { pr_number: expression('inputs.pr-number || \'\'') },
      permissions: { 'contents': 'read', 'pull-requests': 'read', 'actions': 'read', 'statuses': 'write' },
    })
    expect(workflow.concurrency.group).toContain('inputs.pr-number')
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      if (jobName === 'pr-context') {
        continue
      }
      expect(job.permissions?.statuses, `${name}/${jobName} status permission`).not.toBe('write')
      expect([job.needs].flat(), `${name}/${jobName} needs`).toContain('pr-context')
      expect(job.if, `${name}/${jobName} scope`).toContain('needs.pr-context.outputs.should_run == \'true\'')
      if (job.uses === './.github/workflows/reusable-node-command.yml') {
        expect(job.with).toMatchObject({
          checkout_ref: expression('needs.pr-context.outputs.checkout_sha'),
          base_sha: expression('needs.pr-context.outputs.base_sha'),
          head_sha: expression('needs.pr-context.outputs.head_sha'),
          pr_number: expression('needs.pr-context.outputs.pr_number'),
        })
      }
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith('actions/checkout@')) {
          if (step.with?.path === '.tmp/pr-driver') {
            expect(step.with.ref).toBe(expression('github.sha'))
            expect(step.with['persist-credentials']).toBe(false)
            continue
          }
          expect(step.with?.ref, `${name}/${jobName} checkout`).toMatch(/needs\.pr-context\.outputs\.(?:checkout_sha|head_sha|base_sha)/u)
          expect(step.with?.['persist-credentials']).toBe(false)
        }
      }
    }
  })

  it('isolates state writes in trusted resolver and completion reporter jobs', async () => {
    const resolver = await readWorkflow('reusable-pr-context.yml')
    const checkout = resolver.jobs.resolve.steps.find(step => step.uses?.startsWith('actions/checkout@'))
    expect(checkout.with.ref).toBe(expression('github.event.repository.default_branch'))
    expect(checkout.with['persist-credentials']).toBe(false)
    expect(resolver.permissions.statuses).toBe('write')
    const pending = resolver.jobs.resolve.steps.find(step => step.name === 'Publish manual PR status')
    expect(pending.if).toContain('always()')
    expect(pending.if).toContain('context_available')
    const report = await readWorkflow('ci-pr-status.yml')
    expect(report.on.workflow_run.types).toEqual(['in_progress', 'completed'])
    for (const name of [...workflows, 'nightly-performance.yml']) {
      expect(report.on.workflow_run.workflows).toContain((await readWorkflow(name)).name)
      expect((await readWorkflow(name)).permissions.statuses).not.toBe('write')
    }
    expect(report.permissions.statuses).toBe('write')
    expect(report.jobs.report.if).toContain('head_repository.full_name == github.repository')
    expect(report.jobs.report.steps.find(step => step.uses?.startsWith('actions/checkout@')).with.ref)
      .toBe(expression('github.event.repository.default_branch'))
  })

  it('retains scheduled checks and production push triggers', async () => {
    for (const name of ['ci.yml', 'ci-policy.yml', 'ci-e2e.yml', 'ci-tutorial-e2e.yml', 'ci-create-weapp-vite.yml', 'nightly-performance.yml']) {
      expect((await readWorkflow(name)).on.schedule, name).toHaveLength(1)
    }
    expect((await readWorkflow('deploy-website.yml')).on.push.branches).toEqual(['main'])
    expect((await readWorkflow('release.yml')).on.push.branches).toContain('main')
    expect((await readWorkflow('ci-dimina.yml')).on.push.branches).toEqual(['main'])
  })

  it('preserves PR profiles while standalone checks keep their existing matrices', async () => {
    const ci = await readWorkflow('ci.yml')
    expect(ci.jobs['build-pr'].if).toContain('needs.pr-context.outputs.is_pr == \'true\'')
    expect(ci.jobs['build-pr'].strategy.matrix.include).toHaveLength(4)
    expect(ci.jobs['build-release-pr'].strategy.matrix.include).toHaveLength(2)
    expect(ci.jobs['build-full'].if).toContain('needs.pr-context.outputs.is_pr != \'true\'')
    expect(ci.jobs['build-full'].strategy.matrix.include).toHaveLength(6)
    const tutorial = await readWorkflow('ci-tutorial-e2e.yml')
    expect(tutorial.jobs['tutorial-e2e'].strategy.matrix.source).toContain('needs.pr-context.outputs.is_pr == \'true\' && \'["workspace"]\'')
  })

  it('excludes manually validated PRs from production website deployment', async () => {
    const workflow = await readWorkflow('deploy-website.yml')
    const steps = workflow.jobs.website.steps
    for (const name of ['Check production revision', 'Deploy website to Cloudflare']) {
      expect(steps.find(step => step.name === name).if).toContain('needs.pr-context.outputs.is_pr != \'true\'')
    }
  })

  it('uses candidate artifact identity and exports frozen base after runner environment setup', async () => {
    const reusable = await readWorkflow('reusable-node-command.yml')
    const job = reusable.jobs.run
    expect(job.env.BUILD_ARTIFACT_EXPECTED_COMMIT).toBe(expression('inputs.checkout_ref || github.sha'))
    expect(job.env).not.toHaveProperty('GITHUB_BASE_REF')
    expect(job.env.TURBO_TOKEN).toBe(expression('inputs.pr_number == \'\' && secrets.TURBO_TOKEN || \'\''))
    const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'))
    expect(checkout.with.ref).toBe(expression('inputs.checkout_ref || github.sha'))
    expect(checkout.with['fetch-depth']).toBe(expression('inputs.pr_number != \'\' && \'0\' || inputs.fetch_depth'))
    const command = job.steps.find(step => step.name === 'Run command').run
    expect(command).toContain('export GITHUB_BASE_REF="$PR_BASE_SHA"')
    expect(command.indexOf('export GITHUB_BASE_REF')).toBeLessThan(command.indexOf(expression('inputs.main_command')))
    const coverage = job.steps.find(step => step.name === 'Upload coverage reports to Codecov')
    expect(coverage.with).toEqual({
      override_commit: expression('inputs.head_sha || inputs.checkout_ref || github.sha'),
      override_pr: expression('inputs.pr_number'),
      override_branch: expression('inputs.head_ref || github.ref_name'),
    })
    expect(coverage.env.CODECOV_TOKEN).toBe(expression('inputs.pr_number == \'\' && secrets.CODECOV_TOKEN || \'\''))
    const manifest = job.steps.find(step => step.name === 'Create workspace build artifact manifest')
    expect(manifest.shell).toBe('bash')
    expect(manifest.run).toContain('export GITHUB_SHA="$BUILD_ARTIFACT_EXPECTED_COMMIT"')
  })
})
