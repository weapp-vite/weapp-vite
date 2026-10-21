/* eslint-disable no-template-curly-in-string -- GitHub Actions 表达式需要按原始字面量核验。 */
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Workflow {
  on: Record<string, { inputs: Record<string, unknown> }>
  jobs: Record<string, {
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
    for (const name of ['miniapp-platform-pr', 'miniapp-platform-full']) {
      expect(shared.jobs[name]?.with?.exclude_projects).toBe('${{ inputs.exclude-e2e-projects }}')
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
