import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  uses?: string
  with?: Record<string, unknown>
}

interface Workflow {
  jobs: Record<string, { steps: WorkflowStep[] }>
}

describe('tutorial CI toolchain', () => {
  it('checks the latest supported Node 22 patch instead of accepting a stale runner cache', () => {
    const workflow = parse(readFileSync(new URL('../.github/workflows/validate-ci-tutorial-e2e.yml', import.meta.url), 'utf8')) as Workflow
    const setup = workflow.jobs['tutorial-e2e']!.steps.filter(step => step.uses?.startsWith('actions/setup-node@'))

    expect(setup).toHaveLength(1)
    expect(setup[0]?.uses).toMatch(/^actions\/setup-node@[a-f\d]{40}$/)
    expect(setup[0]?.with).toMatchObject({
      'node-version': 22,
      'check-latest': true,
      'cache': 'pnpm',
    })
  })
})
