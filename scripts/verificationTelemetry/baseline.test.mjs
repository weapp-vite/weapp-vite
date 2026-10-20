import fs from 'node:fs/promises'
import { expect, it } from 'vitest'
import YAML from 'yaml'

const root = new URL('../../', import.meta.url)

it('preserves every original workflow job, command, matrix and dependency', async () => {
  const frozen = JSON.parse(await fs.readFile(new URL('./baseline-topology.json', import.meta.url), 'utf8'))
  for (const [file, expected] of Object.entries(frozen)) {
    const workflow = YAML.parse(await fs.readFile(new URL(file, root), 'utf8'))
    const actual = Object.fromEntries(Object.entries(workflow.jobs).map(([id, job]) => [id, Object.fromEntries(Object.entries(job)
      .filter(([key]) => ['name', 'if', 'needs', 'strategy', 'uses', 'runs-on', 'with'].includes(key))
      .map(([key, value]) => [key, key === 'with' ? Object.fromEntries(Object.entries(value).filter(([input]) => input !== 'verification_telemetry')) : value]))]))
    expect(actual, file).toEqual(expected)
  }
})

it('keeps the original coverage command and places verdict finalization after native command success', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('package.json', root), 'utf8'))
  expect(manifest.scripts['test:coverage']).toBe('vitest run --configLoader bundle --coverage.enabled --exclude \'**/.codex-tmp/**\'')
  const workflow = YAML.parse(await fs.readFile(new URL('.github/workflows/reusable-node-command.yml', root), 'utf8'))
  const steps = workflow.jobs.run.steps
  const run = steps.findIndex(step => step.name === 'Run command')
  const verdict = steps.findIndex(step => step.name === 'Finalize original coverage threshold verdict')
  expect(verdict).toBeGreaterThan(run)
  expect(steps[verdict].if).toBe('success() && inputs.verification_telemetry')
  expect(steps[verdict].run).toContain('--command-succeeded')
  expect(steps.find(step => step.name === 'Freeze baseline verification evidence plans')).toBeDefined()
  const coverageUploads = steps.filter(step => step.name?.startsWith('Upload baseline') && step.with?.name?.startsWith('coverage-'))
  expect(coverageUploads).toHaveLength(3)
  expect(coverageUploads.every(step => step.with['include-hidden-files'] === true && step.with['if-no-files-found'] === 'error')).toBe(true)
})
