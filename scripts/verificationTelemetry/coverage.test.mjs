import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { coverageLogicalScope, coveragePlan, finalizeBaselineCoverage, readJson, saveJson } from './coverage.mjs'
import BaselineCoverageReporter from './reporter.mjs'
import { baselineVitestTelemetry } from './vitest.mjs'

const roots = []
const identity = { commit: 'a'.repeat(40), nodeVersion: 'v22.22.2', nodeMajor: '22', packageManager: 'pnpm@12.11.2', os: 'linux', arch: 'x64', configHash: 'b'.repeat(64) }

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'verification-telemetry-'))
  roots.push(root)
  const reporter = new BaselineCoverageReporter({ root, identity })
  const file = path.join(root, 'example.test.ts')
  await reporter.onTestRunStart([{ moduleId: file, project: { name: 'serial' } }])
  await reporter.onTestRunEnd([{ moduleId: file, project: { name: 'serial' }, state: () => 'passed', children: { allTests: () => [{ fullName: 'example > works', result: () => ({ state: 'passed' }) }] } }], [], 'passed')
  const output = path.join(root, '.tmp/verification-telemetry/coverage')
  await fs.writeFile(path.join(output, 'blob.json'), 'native blob fixture')
  return { root, output }
}

it('adds only reporters and blob destination to the original coverage lifecycle', () => {
  expect(baselineVitestTelemetry('/workspace', {})).toEqual({})
  expect(baselineVitestTelemetry('/workspace', { WEAPP_VITE_VERIFICATION_TELEMETRY: '1', npm_lifecycle_event: 'test' })).toEqual({})
  const config = baselineVitestTelemetry('/workspace', { WEAPP_VITE_VERIFICATION_TELEMETRY: '1', npm_lifecycle_event: 'test:coverage' })
  expect(Object.keys(config).sort()).toEqual(['outputFile', 'reporters'])
  expect(config.reporters.slice(0, 2)).toEqual(['default', 'blob'])
})

it('does not emit passed manifests or threshold verdicts at reporter end', async () => {
  const { output } = await fixture()
  expect((await readJson(path.join(output, 'observed.json'))).passed).toBe(true)
  await expect(fs.access(path.join(output, 'manifest.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(fs.access(path.join(output, 'shard-verdict.json'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('removes only its previous evidence files before freezing a new real run', async () => {
  const { root, output } = await fixture()
  await saveJson(path.join(output, 'shard-verdict.json'), { status: 'passed' })
  await fs.writeFile(path.join(output, 'unrelated.txt'), 'preserve')
  await new BaselineCoverageReporter({ root, identity }).onTestRunStart([{ moduleId: path.join(root, 'example.test.ts'), project: { name: 'serial' } }])
  await expect(fs.access(path.join(output, 'shard-verdict.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await fs.readFile(path.join(output, 'unrelated.txt'), 'utf8')).toBe('preserve')
})

it('requires original command success after actual discovery and execution agree', async () => {
  const { root, output } = await fixture()
  await expect(finalizeBaselineCoverage(root, output, { identity, commandSucceeded: false })).rejects.toThrow(/did not succeed/)
  const result = await finalizeBaselineCoverage(root, output, { identity, commandSucceeded: true })
  expect(result.scope).toEqual({ files: ['example.test.ts'], cases: [['example.test.ts', 'example > works', 'passed']] })
  expect((await readJson(path.join(output, 'shard-verdict.json'))).status).toBe('passed')
  expect(result.report.blobHash).toMatch(/^[a-f\d]{64}$/u)
})

it('rejects discovery omissions, failed observations and changed identities', async () => {
  const { root, output } = await fixture()
  await expect(finalizeBaselineCoverage(root, output, { identity: { ...identity, arch: 'arm64' }, commandSucceeded: true })).rejects.toThrow(/identity/)
  const observed = await readJson(path.join(output, 'observed.json'))
  await saveJson(path.join(output, 'observed.json'), { ...observed, passed: false })
  await expect(finalizeBaselineCoverage(root, output, { identity, commandSucceeded: true })).rejects.toThrow(/failure/)
  await saveJson(path.join(output, 'observed.json'), { ...observed, inventory: [] })
  await expect(finalizeBaselineCoverage(root, output, { identity, commandSucceeded: true })).rejects.toThrow(/assignment/)
})

it('allows project reassignment only after each variant proves its exact unique assignment', () => {
  const run = (projectName) => {
    const inventory = [{ file: 'example.test.ts', projectName }]
    const plan = coveragePlan(identity, inventory)
    const report = { planHash: plan.planHash, index: 1, status: 'passed', inventory, cases: [{ ...inventory[0], name: 'works', state: 'passed' }] }
    return { plan, report }
  }
  const baseline = run('serial')
  const candidate = run('fast')
  expect(coverageLogicalScope(baseline.plan, [baseline.report])).toEqual(coverageLogicalScope(candidate.plan, [candidate.report]))
  expect(() => coverageLogicalScope(candidate.plan, [{ ...candidate.report, inventory: [...candidate.report.inventory, ...candidate.report.inventory] }])).toThrow(/duplicate/)
  expect(() => coverageLogicalScope(candidate.plan, [{ ...candidate.report, cases: [{ ...candidate.report.cases[0], projectName: 'serial' }] }])).toThrow(/assignment/)
  expect(() => coverageLogicalScope(candidate.plan, [{ ...candidate.report, cases: [...candidate.report.cases, ...candidate.report.cases] }])).toThrow(/duplicate/)
  expect(() => coverageLogicalScope(candidate.plan, [{ ...candidate.report, cases: [{ ...candidate.report.cases[0], state: 'pending' }] }])).toThrow(/unfinished/)
})
