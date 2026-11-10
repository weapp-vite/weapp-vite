import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Step {
  'name': string
  'run'?: string
  'uses'?: string
  'if'?: string
  'continue-on-error'?: boolean
}

const workflow = parse(readFileSync(new URL('../../.github/workflows/update-wechat-components.yml', import.meta.url), 'utf8')) as {
  jobs: { update: { steps: Step[] } }
}

describe('builtin generation workflow gates', () => {
  it('tests the generator before writing and its consumers after rebuilding, before creating a PR', () => {
    const steps = workflow.jobs.update.steps
    const generatorTest = steps.findIndex(step => step.name === 'Test builtin component generator')
    const generate = steps.findIndex(step => step.run === 'pnpm builtin')
    const build = steps.findIndex(step => step.name === 'Build compiler for snapshot tests')
    const consumers = steps.findIndex(step => step.name === 'Test generated builtin component consumers')
    const createPr = steps.findIndex(step => step.name === 'Create pull request')
    expect(generatorTest).toBeGreaterThanOrEqual(0)
    expect(generate).toBeGreaterThan(generatorTest)
    expect(build).toBeGreaterThan(generate)
    expect(consumers).toBeGreaterThan(build)
    expect(createPr).toBeGreaterThan(consumers)
    expect(steps[generatorTest]?.run).toContain('scripts/builtin/index.test.ts')
    expect(steps[generatorTest]?.if).toBeUndefined()
    expect(steps[consumers]?.run).toContain('auto-import-components/builtin.test.ts')
    expect(steps[consumers]?.run).toContain('vueTemplateTags.test.ts')
    expect(steps[consumers]?.if).toBe(steps[build]?.if)
    expect(steps[consumers]?.if).toBe(steps[createPr]?.if)
    expect(steps.every(step => !step['continue-on-error'])).toBe(true)
  })
})
