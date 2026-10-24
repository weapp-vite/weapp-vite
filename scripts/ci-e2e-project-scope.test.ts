/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式需要按原始字面量核验。 */
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { readVerificationTopologyVariant } from './workflowFixture.mjs'

interface Workflow {
  on: Record<string, { inputs: Record<string, unknown> }>
  jobs: Record<string, {
    if?: string
    name?: string
    uses?: string
    with?: Record<string, unknown>
    env?: Record<string, unknown>
    steps?: Array<{ name?: string, env?: Record<string, unknown>, run?: string }>
  }>
}

async function readWorkflow(name: string) {
  return parse(await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')) as Workflow
}

describe('manual CI E2E project scope', () => {
  it('defaults workspace HMR to full while forwarding an explicit functional-only selection', async () => {
    const wrapper = await readWorkflow('ci-e2e.yml')
    const shared = await readWorkflow('validate-ci-e2e.yml')
    expect(wrapper.on.workflow_dispatch?.inputs['workspace-hmr-audit']).toMatchObject({ type: 'choice', required: false, default: 'full', options: ['full', 'functional-only'] })
    expect(shared.on.workflow_call?.inputs['workspace-hmr-audit']).toEqual({ type: 'string', required: false, default: 'full' })
    expect(wrapper.jobs.validation?.with?.['workspace-hmr-audit']).toBe('${{ inputs.workspace-hmr-audit || \'full\' }}')
    const native = await readWorkflow('ci-pr.yml')
    expect(native.jobs['ci-e2e']?.with).not.toHaveProperty('workspace-hmr-audit')
  })

  it('keeps every job enabled and changes only the explicit nightly audit scope and label', async () => {
    const shared = await readWorkflow('validate-ci-e2e.yml')
    const nightly = shared.jobs['workspace-hmr-nightly']!
    expect(nightly.if).toBe('needs.pr-context.outputs.should_run == \'true\' && (needs.pr-context.outputs.is_pr != \'true\' && (!inputs.hmr-diagnostic || inputs.hmr-diagnostic == \'full\' || inputs.hmr-diagnostic == \'workspace-hmr\'))')
    expect(nightly.name).toBe('${{ inputs.workspace-hmr-audit == \'functional-only\' && \'Workspace HMR Functional (Node 24)\' || \'Workspace HMR Nightly Full (Node 24)\' }}')
    expect(nightly.with?.main_command).toBe('${{ inputs.workspace-hmr-audit == \'functional-only\' && \'pnpm exec cross-env WEAPP_VITE_HMR_AUDIT_FUNCTIONAL_ONLY=1 pnpm audit:hmr:nightly\' || \'pnpm audit:hmr:nightly\' }}')
    for (const [name, job] of Object.entries(shared.jobs)) {
      expect(job.if ?? '', name).not.toContain('workspace-hmr-audit')
      if (name !== 'workspace-hmr-nightly') {
        expect(JSON.stringify(job), name).not.toContain('workspace-hmr-audit')
      }
    }
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }
    expect(manifest.scripts['audit:hmr:nightly']).toContain('WORKSPACE_HMR_FAIL_ON_ERROR=1')
  })

  it('keeps exclusions optional and forwards the manual value without changing native PR defaults', async () => {
    const wrapper = await readWorkflow('ci-e2e.yml')
    const shared = await readWorkflow('validate-ci-e2e.yml')
    for (const input of [wrapper.on.workflow_dispatch?.inputs['exclude-e2e-projects'], shared.on.workflow_call?.inputs['exclude-e2e-projects']]) {
      expect(input).toMatchObject({ type: 'string', required: false, default: '' })
    }
    expect(wrapper.jobs.validation?.with?.['exclude-e2e-projects']).toBe('${{ inputs.exclude-e2e-projects || \'\' }}')
    const native = await readWorkflow('ci-pr.yml')
    expect(native.jobs['ci-e2e']?.with).not.toHaveProperty('exclude-e2e-projects')
  })

  it('passes the same scope through every build, shard, runtime and Web child job', async () => {
    const shared = await readWorkflow('validate-ci-e2e.yml')
    const jobs = Object.entries(shared.jobs).filter(([, job]) => job.uses === './.github/workflows/reusable-node-command.yml')
    expect(jobs.length).toBeGreaterThan(0)
    for (const [name, job] of jobs) {
      expect(job.with?.e2e_exclude_projects, name).toBe('${{ inputs.exclude-e2e-projects }}')
    }
    const baseline = readVerificationTopologyVariant() === 'baseline'
    for (const name of baseline ? ['miniapp-e2e-build-pr', 'miniapp-e2e-build-full', 'miniapp-e2e-ci-pr', 'miniapp-e2e-ci-full'] : ['miniapp-platform-pr', 'miniapp-platform-full']) {
      expect(shared.jobs[name]?.with?.[baseline ? 'e2e_exclude_projects' : 'exclude_projects']).toBe('${{ inputs.exclude-e2e-projects }}')
    }
    const child = await readWorkflow('reusable-miniapp-platform.yml')
    for (const [name, job] of Object.entries(child.jobs).filter(([, job]) => job.uses === './.github/workflows/reusable-node-command.yml')) {
      expect(job.with?.e2e_exclude_projects, name).toBe('${{ inputs.exclude_projects }}')
    }
    expect(child.jobs.plan?.env?.WEAPP_VITE_E2E_EXCLUDE_PROJECTS).toBe('${{ inputs.exclude_projects }}')
  })

  it('exports scope as environment data for all commands and their descendants', async () => {
    const reusable = await readWorkflow('reusable-node-command.yml')
    expect(reusable.on.workflow_call?.inputs.e2e_exclude_projects).toEqual({ type: 'string', required: false, default: '' })
    const job = reusable.jobs.run!
    expect(job.env?.WEAPP_VITE_E2E_EXCLUDE_PROJECTS).toBe('${{ inputs.e2e_exclude_projects }}')
    for (const step of job.steps ?? []) {
      expect(step.env ?? {}).not.toHaveProperty('WEAPP_VITE_E2E_EXCLUDE_PROJECTS')
      expect(step.run ?? '').not.toContain('${{ inputs.e2e_exclude_projects }}')
    }
  })
})
