import fs from 'node:fs/promises'
import { expect, it } from 'vitest'
import YAML from 'yaml'
import { verificationTopologyVariant, workflowTopology } from './topology.mjs'

const root = new URL('../../', import.meta.url)
const readWorkflow = async file => YAML.parse(await fs.readFile(new URL(file, root), 'utf8'))
const variant = async () => verificationTopologyVariant(await readWorkflow('.github/workflows/validate-ci.yml'))

it('preserves every job, command, matrix and dependency of the actual verification variant', async () => {
  const current = await variant()
  const frozen = JSON.parse(await fs.readFile(new URL(`./${current}-topology.json`, import.meta.url), 'utf8'))
  for (const [file, expected] of Object.entries(frozen)) {
    expect(workflowTopology(await readWorkflow(file), current), file).toEqual(expected)
  }
})

it('keeps the original coverage command and gates publication on the variant threshold verdict', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('package.json', root), 'utf8'))
  expect(manifest.scripts['test:coverage']).toBe('vitest run --configLoader bundle --coverage.enabled --exclude \'**/.codex-tmp/**\'')
  if (await variant() === 'baseline') {
    const workflow = await readWorkflow('.github/workflows/reusable-node-command.yml')
    const steps = workflow.jobs.run.steps
    const run = steps.findIndex(step => step.name === 'Run command')
    const verdict = steps.findIndex(step => step.name === 'Finalize original coverage threshold verdict')
    expect(run).toBeGreaterThanOrEqual(0)
    expect(verdict).toBeGreaterThan(run)
    expect(steps[verdict].if).toBe('success() && inputs.verification_telemetry')
    expect(steps[verdict].run).toContain('--command-succeeded')
    expect(steps.find(step => step.name === 'Freeze baseline verification evidence plans')).toBeDefined()
    const coverageUploads = steps.filter(step => step.name?.startsWith('Upload baseline') && step.with?.name?.startsWith('coverage-'))
    expect(coverageUploads).toHaveLength(3)
    expect(coverageUploads.every(step => step.with['include-hidden-files'] === true && step.with['if-no-files-found'] === 'error')).toBe(true)
  }
  else {
    const workflow = await readWorkflow('.github/workflows/reusable-quality-platform.yml')
    expect(workflow.jobs.coverage.strategy.matrix.shard).toEqual([1, 2, 3, 4])
    const merge = workflow.jobs['coverage-merge']
    expect(merge.needs).toEqual(['pr-context', 'build', 'coverage'])
    expect(merge.if).toBe(`\${{ !cancelled() && inputs.run_coverage && needs.build.result == 'success' }}`)
    const steps = merge.steps
    const verdict = steps.findIndex(step => step.name === 'Merge native coverage with original thresholds')
    expect(verdict).toBeGreaterThanOrEqual(0)
    expect(steps[verdict].if).toBeUndefined()
    expect(steps[verdict]['continue-on-error']).toBeUndefined()
    expect(steps[verdict].run).toBe('node scripts/coverageShards/index.mjs merge --plan=.tmp/coverage-plan/plan.json --reports=.tmp/coverage-reports --output=coverage')
    const codecov = steps.findIndex(step => step.uses?.startsWith('codecov/'))
    expect(codecov).toBeGreaterThan(verdict)
    expect(steps[codecov].if).toBeUndefined()
    expect(steps[codecov]['continue-on-error']).toBeUndefined()
    const upload = steps.find(step => step.name === 'Upload complete coverage verdict')
    expect(upload.with.path).toBe('coverage')
    expect(upload.with['if-no-files-found']).toBe('error')
  }
})

it('rejects unknown or mixed topology implementations instead of omitting a guard', () => {
  const workflow = uses => ({ jobs: Object.fromEntries(['build-pr', 'build-release-pr', 'build-full'].map(id => [id, { uses }])) })
  expect(verificationTopologyVariant(workflow('./.github/workflows/reusable-node-command.yml'))).toBe('baseline')
  expect(verificationTopologyVariant(workflow('./.github/workflows/reusable-quality-platform.yml'))).toBe('candidate')
  expect(() => verificationTopologyVariant(workflow('./.github/workflows/unknown.yml'))).toThrow('Unknown or mixed')
  const mixed = workflow('./.github/workflows/reusable-node-command.yml')
  mixed.jobs['build-full'].uses = './.github/workflows/reusable-quality-platform.yml'
  expect(() => verificationTopologyVariant(mixed)).toThrow('Unknown or mixed')
  delete mixed.jobs['build-pr']
  expect(() => verificationTopologyVariant(mixed)).toThrow('Unknown or mixed')
})

it.each(['command', 'environment', 'failure policy'])('detects a candidate native job bypass through its %s', async (change) => {
  const frozen = JSON.parse(await fs.readFile(new URL('./candidate-topology.json', import.meta.url), 'utf8'))
  const expected = frozen['.github/workflows/reusable-quality-platform.yml']
  const workflow = { jobs: structuredClone(expected) }
  const merge = workflow.jobs['coverage-merge']
  if (change === 'command') {
    merge.steps.find(step => step.name === 'Merge native coverage with original thresholds').run = 'node --version'
  }
  else if (change === 'environment') {
    merge.env.BUILD_ARTIFACT_EXPECTED_COMMIT = 'unverified'
  }
  else {
    merge['continue-on-error'] = true
  }
  expect(workflowTopology(workflow, 'candidate')).not.toEqual(expected)
})

it.each(['command', 'environment', 'failure policy', 'telemetry'])('detects a baseline native job bypass through its %s', async (change) => {
  const frozen = JSON.parse(await fs.readFile(new URL('./baseline-topology.json', import.meta.url), 'utf8'))
  const expected = frozen['.github/workflows/reusable-node-command.yml']
  const workflow = { jobs: structuredClone(expected) }
  const job = workflow.jobs.run
  if (change === 'command') {
    job.steps.find(step => step.name === 'Run command').run = 'node --version'
  }
  else if (change === 'environment') {
    job.env.BUILD_ARTIFACT_EXPECTED_COMMIT = 'unverified'
  }
  else if (change === 'telemetry') {
    job.env.WEAPP_VITE_VERIFICATION_TELEMETRY = '0'
  }
  else {
    job['continue-on-error'] = true
  }
  expect(workflowTopology(workflow, 'baseline')).not.toEqual(expected)
})
