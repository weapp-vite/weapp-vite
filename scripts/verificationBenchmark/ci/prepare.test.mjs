import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { classifyCoverageScope, coverageScopePolicy } from '../../verificationTelemetry/coveragePolicy.mjs'
import { coverageLogicalScope } from '../../verificationTelemetry/logicalCoverage.mjs'
import { collectCiEvidence } from '../ci.mjs'
import { fixture, time } from './fixture.mjs'
import { prepareCiBenchmark } from './prepare.mjs'

function discoveryFixture() {
  const value = fixture()
  const shard = value.files['coverage-shard-1']['manifest.json']
  shard.cases = [{ ...shard.inventory[0], name: 'works', state: 'passed' }]
  Object.assign(value.immutableFiles, {
    'package.json': JSON.stringify({ scripts: { build: 'build', verify: 'verify' } }),
    'pnpm-lock.yaml': 'lockfileVersion: 9',
    'pnpm-workspace.yaml': 'packages: [packages/*]',
    'turbo.json': JSON.stringify({ tasks: { build: { dependsOn: ['^build'] } } }),
    'vitest.coverage.ts': 'export const thresholds = { lines: 100 }',
    '.github/workflows/ci-pr.yml': `jobs:
  approval:
    name: Approve PR checks
  build:
    needs: approval
  tests:
    needs: build
  lint:
    needs: approval
`,
  })
  for (const name of ['coverage-plan', 'coverage-shard-1', 'coverage-complete']) {
    const actual = name === 'coverage-shard-1' ? 'coverage-shard-linux-node-24-1' : `${name}-linux-node-24`
    value.files[actual] = value.files[name]
    delete value.files[name]
    value.artifacts.find(artifact => artifact.name === name).name = actual
  }
  return value
}

it('prepares a reviewable immutable input/topology contract using actual successful evidence', async () => {
  const value = discoveryFixture()
  const result = await prepareCiBenchmark(value.repository, 123, { profile: value.contract.profile, cohort: value.configuration.cohort }, value.execute)
  expect(result).toMatchObject({ kind: 'ci-benchmark-preparation', formalSample: false, configuration: { identity: value.configuration.identity }, contract: { draft: true, needs: value.configuration.needs } })
  expect(result.contract.evidence).toHaveLength(1)
  expect(result.contract.evidence[0]).toMatchObject({ kind: 'coverage', scopeLevel: 'audited-cases', scopePolicy: coverageScopePolicy, scope: classifyCoverageScope(coverageLogicalScope(value.files['coverage-plan-linux-node-24']['plan.json'], [value.files['coverage-shard-linux-node-24-1']['manifest.json']])) })
  expect(result.receipt.inputs.inventory.map(entry => entry[0])).toContain('packages/framework/src/index.ts')
  expect(result.receipt.inputs.projectedFields['package.json']).toContain('scripts.verify')
  expect(result.gaps.map(gap => gap.id)).toContain('review')
  expect(result.gaps.map(gap => gap.id)).toContain('runtime')
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
})

it('records partial discovery evidence as a gap and still removes its downloads', async () => {
  const value = discoveryFixture()
  value.files['coverage-complete-linux-node-24']['shard-verdict.json'].status = 'failed'
  const result = await prepareCiBenchmark(value.repository, 123, { profile: value.contract.profile, cohort: value.configuration.cohort }, value.execute)
  expect(result.contract.evidence).toEqual([])
  expect(result.gaps.some(gap => gap.reason.includes('threshold'))).toBe(true)
  expect(value.downloads.every(directory => !existsSync(path.dirname(directory)))).toBe(true)
})

it('does not accept a committed discovery draft as a formal sample', async () => {
  const value = fixture()
  value.contract.draft = true
  await expect(collectCiEvidence(value.repository, 123, value.configuration, value.execute)).rejects.toThrow(/contract/u)
})

it('discovers one descriptor per current artifact while retaining old attempt metadata', async () => {
  const value = discoveryFixture()
  const artifact = value.artifacts.find(artifact => artifact.name.startsWith('coverage-plan-'))
  value.artifacts.push({ ...artifact, id: 99, created_at: time(-1), expired: true })
  const result = await prepareCiBenchmark(value.repository, 123, { profile: value.contract.profile, cohort: value.configuration.cohort }, value.execute)
  expect(result.contract.evidence.filter(evidence => evidence.kind === 'coverage')).toHaveLength(1)
  expect(result.receipt.artifactInventory).toHaveLength(5)
  expect(result.receipt.downloadedArtifacts.some(artifact => artifact.id === 99)).toBe(false)
})
