import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, it } from 'vitest'
import { parse } from 'yaml'

it('keeps explicit SDK preparation, strict browser acceptance and bounded cache/evidence in independent CI', async () => {
  const workflow = parse(await readFile(path.resolve(import.meta.dirname, '../.github/workflows/ci-dimina.yml'), 'utf8')) as {
    jobs: Record<string, { steps: { 'name'?: string, 'run'?: string, 'uses'?: string, 'if'?: string, 'continue-on-error'?: boolean, 'with'?: Record<string, unknown> }[] }>
  }
  const steps = workflow.jobs.web!.steps
  const commandIndex = (command: string) => steps.findIndex(step => step.run === command)
  const setup = commandIndex('pnpm --filter @weapp-vite/dimina-playground setup:dimina --reuse')
  const build = commandIndex('pnpm --filter @weapp-vite/dimina-playground build')
  const e2e = commandIndex('pnpm e2e:dimina')
  expect(setup).toBeGreaterThan(-1)
  expect(build).toBeGreaterThan(setup)
  expect(e2e).toBeGreaterThan(build)
  expect(steps[setup]?.if).toBeUndefined()
  expect(steps[e2e]?.if).toBeUndefined()
  expect(steps.every(step => !step['continue-on-error'])).toBe(true)
  const cache = steps.find(step => step.uses?.startsWith('actions/cache@'))!
  expect(cache.with?.key).toBe('$' + '{{ steps.sdk-key.outputs.key }}')
  expect(cache.with?.['restore-keys']).toBeUndefined()
  expect(String(cache.with?.path).trim().split('\n')).toEqual(['.cache/dimina/ready.json', '.cache/dimina/build-*/fe'])
  const evidence = steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))!
  expect(evidence.if).toBe('always()')
  expect(evidence.with?.['include-hidden-files']).toBe(true)
  expect(String(evidence.with?.path).trim().split('\n')).toEqual(['docs/reports/*-e2e-dimina-*-suite-report/**', '.cache/dimina/screenshots/**'])
})
