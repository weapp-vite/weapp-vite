import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCLI } from 'vitest/node'
import { parse } from 'yaml'

interface Step {
  'name': string
  'run'?: string
  'uses'?: string
  'if'?: string
  'continue-on-error'?: boolean
  'with'?: { 'add-paths'?: string }
}

const workflow = parse(readFileSync(new URL('../../.github/workflows/update-wechat-components.yml', import.meta.url), 'utf8')) as {
  jobs: { update: { steps: Step[] } }
}

describe('builtin generation workflow gates', () => {
  it('passes both resolver tests to Vitest without consuming a path as the snapshot update mode', () => {
    const command = workflow.jobs.update.steps.find(step => step.name === 'Update unit test snapshots')?.run
    expect(command).toBeDefined()
    const { filter, options } = parseCLI(command!.replace(/^pnpm /, ''))
    expect(options.update).toBe('all')
    expect(filter).toEqual([
      'packages/weapp-vite/test/resolvers/tdesign.test.ts',
      'packages/weapp-vite/test/resolvers/vant.test.ts',
    ])
  })

  it('tests the generator before writing and its consumers after rebuilding, before creating a PR', () => {
    const steps = workflow.jobs.update.steps
    const generatorTest = steps.findIndex(step => step.name === 'Test builtin component generator')
    const generate = steps.findIndex(step => step.run === 'pnpm builtin')
    const build = steps.findIndex(step => step.name === 'Build compiler for snapshot tests')
    const consumers = steps.findIndex(step => step.name === 'Test generated builtin component consumers')
    const createPr = steps.findIndex(step => step.name === 'Create pull request')
    const releaseIntent = steps.findIndex(step => step.name === 'Generate component update changeset')
    expect(generatorTest).toBeGreaterThanOrEqual(0)
    expect(generate).toBeGreaterThan(generatorTest)
    expect(build).toBeGreaterThan(generate)
    expect(consumers).toBeGreaterThan(build)
    expect(releaseIntent).toBeGreaterThan(consumers)
    expect(createPr).toBeGreaterThan(releaseIntent)
    expect(steps[releaseIntent]?.run).toBe('node --import tsx scripts/builtinChangeset.ts')
    expect(steps[releaseIntent]?.if).toBe(steps[createPr]?.if)
    expect(steps[createPr]?.with?.['add-paths']).toContain('.changeset/wechat-components-*.md')
    expect(steps[generatorTest]?.run).toContain('scripts/builtin')
    expect(steps[generatorTest]?.if).toBeUndefined()
    expect(steps[consumers]?.run).toContain('auto-import-components/builtin.test.ts')
    expect(steps[consumers]?.run).toContain('vueTemplateTags.test.ts')
    expect(steps[consumers]?.if).toBe(steps[build]?.if)
    expect(steps[consumers]?.if).toBe(steps[createPr]?.if)
    expect(steps.every(step => !step['continue-on-error'])).toBe(true)
  })
})
