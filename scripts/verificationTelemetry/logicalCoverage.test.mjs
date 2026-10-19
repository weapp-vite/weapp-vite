import { expect, it } from 'vitest'
import { captureCoverageCases, coverageLogicalScope } from './logicalCoverage.mjs'

const test = (name, state) => ({ fullName: name, result: () => ({ state }) })

it('collapses duplicate Vitest module notifications without hiding state changes', () => {
  const module = {
    moduleId: `${process.cwd()}/scripts/verificationTelemetry/example.test.mjs`,
    project: { name: 'repo-scripts' },
    children: { allTests: () => [test('same', 'passed'), test('same', 'passed'), test('changed', 'passed'), test('changed', 'skipped')] },
  }
  expect(captureCoverageCases([module], process.cwd())).toEqual([
    { file: 'scripts/verificationTelemetry/example.test.mjs', projectName: 'repo-scripts', name: 'same', state: 'passed' },
    { file: 'scripts/verificationTelemetry/example.test.mjs', projectName: 'repo-scripts', name: 'changed', state: 'passed' },
    { file: 'scripts/verificationTelemetry/example.test.mjs', projectName: 'repo-scripts', name: 'changed', state: 'skipped' },
  ])
})

it('keeps project identity when checking duplicate logical cases', () => {
  const plan = {
    schemaVersion: 1,
    shards: 2,
    inventory: [
      { file: 'shared.test.mjs', projectName: 'first' },
      { file: 'shared.test.mjs', projectName: 'second' },
    ],
  }
  const reports = [
    { planHash: 'plan', status: 'passed', index: 1, inventory: [plan.inventory[0]], cases: [{ ...plan.inventory[0], name: 'same', state: 'passed' }] },
    { planHash: 'plan', status: 'passed', index: 2, inventory: [plan.inventory[1]], cases: [{ ...plan.inventory[1], name: 'same', state: 'passed' }] },
  ]
  expect(() => coverageLogicalScope({ ...plan, planHash: 'plan' }, reports)).not.toThrow()
})
