import type { IsolatedMachineLease } from '../../utils/testSupport/machineLease'
import type { SuiteTask } from '../suiteRunner'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIsolatedMachineLease } from '../../utils/testSupport/machineLease'
import { getIdeExhaustiveTasks, IDE_EXHAUSTIVE_OUT_OF_SCOPE_LABELS, IDE_GITHUB_ISSUES_AGGREGATE_LABEL, IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS, IDE_TDESIGN_AGGREGATE_LABEL, IDE_TDESIGN_AGGREGATED_PATTERNS } from '../e2e-suite-manifest'
import { createSuiteReport } from '../suiteReport'
import { runTaskSuite as runTaskSuiteWithOptions } from '../suiteRunner'
import { currentVerificationProfile } from '../verification/profile'
import * as acceptanceHelpers from './helpers'
import { validateTaskAcceptance } from './task'

let machine: IsolatedMachineLease
beforeEach(async () => {
  machine = await createIsolatedMachineLease()
  for (const [key, value] of Object.entries(machine.environment)) {
    vi.stubEnv(key, value)
  }
})

function runTaskSuite(...[name, tasks, options]: Parameters<typeof runTaskSuiteWithOptions>) {
  return runTaskSuiteWithOptions(name, tasks, { ...options, machineLeaseOptions: { stateDirectory: machine.stateDirectory } })
}

const temporaryRoots: string[] = []
const identity = { runId: 'test-run', commitSha: 'test-commit' }

afterEach(async () => {
  try {
    for (const root of temporaryRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
    process.exitCode = 0
    await machine.dispose()
  }
  finally {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  }
})

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-acceptance-test-'))
  temporaryRoots.push(root)
  return root
}

describe('strict IDE suite acceptance', () => {
  it.each([
    ['e2e:ide-full', true],
    ['e2e:ide-full', false],
    ['e2e:ide-dom-headless', true],
    ['e2e:ide-dom-headless', false],
  ] as const)('requires evidence in %s with failOnTaskFailure=%s', async (suite, failOnTaskFailure) => {
    vi.stubEnv('WEAPP_VITE_E2E_DOM_ACCEPTANCE', '0')
    const task: SuiteTask = { label: 'missing-evidence', command: 'node', args: [] }
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // 固定身份采样，仍让真实 runner 根据 suite 名称决定严格验收，避免无关 Git 扫描。
    vi.spyOn(acceptanceHelpers, 'createAcceptanceIdentity').mockReturnValue(identity)
    const code = await runTaskSuite(suite, [task], {
      runTask: async () => 0,
      failOnTaskFailure,
      writeReport: false,
    })
    expect(task.env?.WEAPP_VITE_E2E_DOM_ACCEPTANCE).toBe('1')
    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
  })

  it('preserves unexecuted and out-of-scope tasks after an early failure', () => {
    const report = createSuiteReport([{ label: 'first', artifacts: [], durationMs: 1, exitCode: 1 }], 'ide-test', undefined, temporaryRoot(), {
      ...identity,
      strict: true,
      partial: false,
      plannedTasks: [{ label: 'first' }, { label: 'second' }, { label: 'swan', outOfScopeReason: 'Different host' }],
    })
    expect(report.coverage).toBe('partial')
    expect(report.summary).toMatchObject({ plannedCount: 2, executedCount: 1, failedCount: 1, notExecutedCount: 1, outOfScopeCount: 1 })
    expect(report.tasks.map(task => task.status)).toEqual(['failed', 'not-executed', 'out-of-scope'])
    const json = fs.readFileSync(path.join(report.reportDir, report.jsonFile), 'utf8')
    expect(json).not.toContain(temporaryRoots[0])
  })

  it('cannot label a filtered passing run as complete acceptance', () => {
    const report = createSuiteReport([{ label: 'selected', artifacts: [], durationMs: 1, exitCode: 0 }], 'ide-test', undefined, temporaryRoot(), {
      ...identity,
      strict: true,
      partial: true,
      plannedTasks: [{ label: 'selected' }],
    })
    expect(report.coverage).toBe('partial')
    expect(report.acceptance).toBe('incomplete')
  })

  it('rejects duplicate, unplanned and invalid task results before writing a report', () => {
    const result = { label: 'selected', artifacts: [], durationMs: 1, exitCode: 0 }
    const context = { ...identity, strict: false, partial: false, plannedTasks: [{ label: 'selected' }] }
    expect(() => createSuiteReport([result, result], 'unit', undefined, temporaryRoot(), context)).toThrow('duplicate')
    expect(() => createSuiteReport([{ ...result, label: 'other' }], 'unit', undefined, temporaryRoot(), context)).toThrow('unplanned')
    expect(() => createSuiteReport([{ ...result, durationMs: Number.NaN }], 'unit', undefined, temporaryRoot(), context)).toThrow('invalid')
    expect(() => createSuiteReport([result], 'unit', undefined, temporaryRoot(), { ...context, plannedTasks: [context.plannedTasks[0]!, context.plannedTasks[0]!] })).toThrow('duplicate')
    const timing = { name: 'build', invocationId: 'unique', startedAt: '2026-10-19T00:00:00.000Z', durationMs: 1, status: 'passed' as const }
    expect(() => createSuiteReport([{ ...result, timings: [timing] }], 'unit', undefined, temporaryRoot(), { ...context, timings: [timing] })).toThrow('Invalid E2E timing')
    expect(() => createSuiteReport([{ ...result, timings: [{ ...timing, durationMs: Number.NaN }] }], 'unit', undefined, temporaryRoot(), context)).toThrow('Invalid E2E timing')
  })

  it('records machine acquisition separately from actual tasks and preserves the caller context', async () => {
    const task: SuiteTask = { label: 'unit-task', command: 'node', args: [] }
    const context = { ...identity, strict: false, partial: false, plannedTasks: [task] }
    let captured: ReturnType<typeof createSuiteReport> | undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    await runTaskSuite('unit-timing', [task], {
      runTask: async () => 0,
      reportContext: context,
      onReport: (report) => {
        captured = report
        temporaryRoots.push(report.reportDir)
      },
    })
    expect(captured?.timings).toEqual([expect.objectContaining({ name: 'machine-lease-acquisition', status: 'passed' })])
    expect(captured!.timings![0]!.durationMs).toBeGreaterThanOrEqual(0)
    expect(context).not.toHaveProperty('timings')
  })

  it.each(['shard', 'ad-hoc'] as const)('keeps %s reports partial while only an explicit shard can finish successfully', async (scope) => {
    const label = 'unit-accepted-task'
    const startedAt = '2026-10-19T00:00:00.000Z'
    const finishedAt = '2026-10-19T00:00:02.000Z'
    const cases = [acceptanceHelpers.evaluateAcceptanceCase({
      id: 'mount',
      file: `e2e/${label}`,
      name: 'mounts',
      state: 'passed',
      startedAt: Date.parse(startedAt),
      finishedAt: Date.parse(finishedAt),
      acceptance: {
        fixture: 'e2e-apps/example',
        provider: 'headless',
        checkpoints: [{ id: 'mounted', route: '/pages/index/index', action: 'mount', nodes: [{ selector: '.title', text: 'Ready' }] }],
        evidence: [{ id: 'mounted', route: 'pages/index/index', source: 'headless-logical-tree', capturedAt: '2026-10-19T00:00:01.000Z', nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
      },
    })]
    const file = path.join(temporaryRoot(), 'acceptance.json')
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: 1,
      ...identity,
      invocationId: 'unit-invocation',
      taskLabel: label,
      template: null,
      provider: 'headless',
      strict: true,
      startedAt,
      finishedAt,
      status: 'passed',
      errors: [],
      environment: { nodeVersion: process.version, ideVersion: null, baseLibraryVersion: null },
      cases,
      summary: acceptanceHelpers.summarizeAcceptanceCases(cases),
    }))
    const task: SuiteTask = { label, command: 'node', args: [], env: { WEAPP_VITE_E2E_RUNTIME_PROVIDER: 'headless' }, artifacts: [{ kind: 'dom-acceptance-report', indexPath: file }] }
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const execution = { scope, status: 'incomplete' as const, profile: currentVerificationProfile('ci-full'), assignedTasks: [label], startedAt, finishedAt }
    const context = { ...identity, strict: true, partial: true, plannedTasks: [task], execution, plannedCases: { [label]: [{ file: `e2e/${label}`, name: 'mounts' }] } }
    const code = await runTaskSuite('unit-shard', [task], { runTask: async () => 0, writeReport: false, reportContext: context })
    expect(code).toBe(scope === 'shard' ? 0 : 1)
    const report = createSuiteReport([{ label, exitCode: 0, durationMs: 1, artifacts: [] }], 'unit', undefined, temporaryRoot(), context)
    expect(report).toMatchObject({ coverage: 'partial', acceptance: 'incomplete' })
  })

  it('does not accept a zero exit code without case reports, even with allow-failures', async () => {
    const task: SuiteTask = { label: 'missing-evidence', command: 'node', args: [] }
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runTaskSuite('acceptance-unit', [task], {
      runTask: async () => 0,
      failOnTaskFailure: false,
      writeReport: false,
      reportContext: { ...identity, strict: true, partial: false, plannedTasks: [task] },
    })
    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    await expect(validateTaskAcceptance(task, identity)).rejects.toThrow('Missing DOM acceptance')
  })

  it('keeps only the three optional Baidu tasks outside exhaustive WeChat scope', () => {
    const tasks = getIdeExhaustiveTasks()
    expect(tasks.filter(task => task.outOfScopeReason).map(task => task.label).sort()).toEqual([...IDE_EXHAUSTIVE_OUT_OF_SCOPE_LABELS].sort())
    expect(tasks.filter(task => !task.outOfScopeReason).length).toBeGreaterThanOrEqual(86)
    const templateTask = tasks.find(task => task.label === 'ide/template-dev-open-all.runtime.test.ts')
    expect(templateTask?.acceptanceTemplates).toContain('weapp-vite-template')
    expect(new Set(templateTask?.acceptanceTemplates).size).toBe(templateTask?.acceptanceTemplates?.length)
  })

  it.each([
    [IDE_GITHUB_ISSUES_AGGREGATE_LABEL, IDE_GITHUB_ISSUES_AGGREGATED_PATTERNS],
    [IDE_TDESIGN_AGGREGATE_LABEL, IDE_TDESIGN_AGGREGATED_PATTERNS],
  ])('requires %s imports to match every manifest child', (label, children) => {
    const e2eRoot = path.resolve(import.meta.dirname, '../..')
    const aggregate = path.resolve(e2eRoot, label)
    const ast = ts.createSourceFile(aggregate, fs.readFileSync(aggregate, 'utf8'), ts.ScriptTarget.Latest, true)
    const importedTests = ast.statements
      .filter(ts.isImportDeclaration)
      .map(node => ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '')
      .filter(value => value.endsWith('.test'))
      .map(value => path.relative(e2eRoot, path.resolve(path.dirname(aggregate), `${value}.ts`)).replaceAll('\\', '/'))
    expect(importedTests.sort()).toEqual([...children].sort())
  })
})
