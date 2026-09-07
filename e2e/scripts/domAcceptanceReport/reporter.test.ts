import type { TestCase, TestModule } from 'vitest/node'
import type { DomAcceptance } from '../../utils/domAcceptance/types'
import type { AcceptanceReport } from './types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertAcceptanceReportPassed, createAcceptanceIdentity } from './helpers'
import DomAcceptanceReporter from './reporter'
import { validateTaskAcceptance } from './task'

let reportDir = ''
let commitSha = ''

beforeEach(() => {
  reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-reporter-'))
  commitSha = createAcceptanceIdentity({}).commitSha
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR', reportDir)
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID', 'test-run')
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_SHA', commitSha)
  vi.stubEnv('WEAPP_VITE_E2E_DOM_ACCEPTANCE', '1')
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_TASK', 'template-suite')
  const journalPath = path.join(reportDir, 'runtime.jsonl')
  fs.writeFileSync(journalPath, '')
  vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', journalPath)
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(() => {
  fs.rmSync(reportDir, { recursive: true, force: true })
  process.exitCode = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function createTest(state: 'passed' | 'skipped' | 'pending', name = 'renders title'): TestCase {
  const startTime = Date.now()
  const acceptance: DomAcceptance = {
    fixture: 'e2e-apps/base',
    provider: 'devtools',
    checkpoints: [{ id: 'mount', action: 'launch', route: 'pages/index/index', nodes: [{ selector: '.title', text: 'Ready' }] }],
    evidence: [{ id: 'mount', route: 'pages/index/index', source: 'devtools-page-frame', capturedAt: new Date().toISOString(), nodes: [{ selector: '.title', query: 'css', count: 1, nodes: [{ text: 'Ready' }] }] }],
  }
  return {
    id: name,
    fullName: name,
    module: { relativeModuleId: 'e2e/ide/example.test.ts' },
    result: () => ({ state }),
    meta: () => ({ domAcceptance: acceptance }),
    diagnostic: () => ({ startTime }),
  } as unknown as TestCase
}

function createModule(tests: TestCase[]): TestModule {
  return {
    relativeModuleId: 'e2e/ide/example.test.ts',
    errors: () => [],
    children: {
      allTests: () => tests.values(),
      allSuites: () => [].values(),
    },
  } as unknown as TestModule
}

function readReports() {
  return fs.readdirSync(reportDir).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(reportDir, file), 'utf8')) as AcceptanceReport)
}

describe('Vitest DOM reporter lifecycle', () => {
  it.each(['unconfigured', 'missing'] as const)('rejects an %s diagnostic journal only when strict acceptance finishes', (state) => {
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', state === 'unconfigured' ? undefined : path.join(reportDir, 'missing.jsonl'))
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunStart()
    expect(readReports()[0]?.errors).toEqual([])
    expect(() => reporter.onTestRunEnd([createModule([createTest('passed')])], [], 'passed')).toThrow('Strict DOM acceptance failed')
    expect(readReports()[0]?.errors).toContain(state === 'unconfigured'
      ? 'Strict DOM acceptance requires a configured IDE diagnostic event journal'
      : 'Strict DOM acceptance requires an existing IDE diagnostic event journal')
  })

  it('accepts an existing empty journal when no runtime errors occurred', () => {
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunEnd([createModule([createTest('passed')])], [], 'passed')
    expect(readReports()[0]).toMatchObject({ status: 'passed', errors: [], runtimeDiagnostics: [] })
  })

  it.each(['unconfigured', 'missing'] as const)('preserves non-strict reporting with an %s diagnostic journal', (state) => {
    vi.stubEnv('WEAPP_VITE_E2E_DOM_ACCEPTANCE', '0')
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', state === 'unconfigured' ? undefined : path.join(reportDir, 'missing.jsonl'))
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunEnd([createModule([createTest('passed')])], [], 'passed')
    expect(readReports()[0]).toMatchObject({ status: 'passed', strict: false, errors: [] })
  })

  it('retains an unfinished snapshot before any test runs', () => {
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunStart()
    reporter.onTestModuleCollected(createModule([createTest('pending')]))
    expect(readReports()[0]).toMatchObject({ finishedAt: null, status: 'not-executed', summary: { plannedCount: 1, notExecutedCount: 1 } })
  })

  it('preserves the last complete snapshot if a new report write is interrupted', () => {
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunStart()
    reporter.onTestModuleCollected(createModule([createTest('pending')]))
    const before = readReports()
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('interrupted before report replacement')
    })
    expect(() => reporter.onTestRunEnd([createModule([createTest('passed')])], [], 'passed')).toThrow('interrupted')
    expect(readReports()).toEqual(before)
    expect(readReports()[0]?.status).toBe('not-executed')
  })

  it.each(['skipped', 'pending'] as const)('fails strict acceptance for a %s child in an aggregate', (state) => {
    const reporter = new DomAcceptanceReporter()
    expect(() => reporter.onTestRunEnd([createModule([createTest('passed'), createTest(state, 'aggregate child')])], [], 'passed')).toThrow('Strict DOM acceptance failed')
    expect(readReports()[0]?.summary.plannedCount).toBe(2)
    expect(readReports()[0]?.summary.passedCount).toBe(1)
  })

  it('fails empty modules and retains runtime errors', () => {
    const reporter = new DomAcceptanceReporter()
    expect(() => reporter.onTestRunEnd([createModule([])], [{ message: 'Unexpected AppService exception' }], 'failed')).toThrow()
    expect(readReports()[0]?.errors).toContain('Unexpected AppService exception')
    expect(readReports()[0]?.errors).toContain('No cases collected in e2e/ide/example.test.ts')
  })

  it('fails strict acceptance on startup errors even after automator memory logs reset', () => {
    const journalPath = path.join(reportDir, 'runtime.jsonl')
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', journalPath)
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunStart()
    fs.appendFileSync(journalPath, `${JSON.stringify({ source: 'runtime', kind: 'message', project: 'base', level: 'exception', text: 'Startup exception' })}\n`)
    reporter.onTestCaseReady(createTest('passed'))
    expect(() => reporter.onTestRunEnd([createModule([createTest('passed')])], [], 'passed')).toThrow('Strict DOM acceptance failed')
    expect(readReports()[0]?.errors).toContain('Unclassified IDE runtime exception outside a case: Startup exception')
    expect(readReports()[0]?.runtimeDiagnostics).toMatchObject([{ caseId: null, phase: 'outside-case', event: { text: 'Startup exception' } }])
  })

  it('retains and revalidates exact expected errors bound to a rendered checkpoint', () => {
    const journalPath = path.join(reportDir, 'runtime.jsonl')
    vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', journalPath)
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunStart()
    const test = createTest('passed')
    const plan = (test.meta() as { domAcceptance: DomAcceptance }).domAcceptance
    plan.checkpoints[0]!.expectedErrors = [{ source: 'runtime', level: 'error', channel: 'runtime', text: 'Expected rejection', count: 1 }]
    plan.errorScopes = [{ checkpoint: 'mount', id: 'scope-a' }]
    reporter.onTestCaseReady(test)
    const boundary = (phase: 'start' | 'end') => ({ source: 'runtime', kind: 'message', project: 'base', level: 'debug', acceptanceScope: { id: 'scope-a', caseId: test.id, checkpointId: 'mount', boundary: phase } })
    const events = [boundary('start'), { source: 'runtime', kind: 'message', project: 'base', level: 'error', channel: 'runtime', text: 'Expected rejection' }, boundary('end')]
    fs.writeFileSync(journalPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`)
    reporter.onTestRunEnd([createModule([test])], [], 'passed')
    const report = readReports()[0]!
    const identity = { runId: 'test-run', commitSha }
    expect(report.errors).toEqual([])
    expect(report.runtimeDiagnostics?.[1]).toMatchObject({ caseId: test.id, checkpointId: 'mount', scopeId: 'scope-a' })
    expect(() => assertAcceptanceReportPassed(report, identity)).not.toThrow()
    report.cases[0]!.acceptance!.checkpoints[0]!.expectedErrors![0]!.count = 2
    expect(() => assertAcceptanceReportPassed(report, identity)).toThrow('did not finish')
  })

  it('uses separate invocation files for template children and detects an omitted child', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_TEMPLATE', 'template-a')
    new DomAcceptanceReporter().onTestRunEnd([createModule([createTest('passed')])], [], 'passed')
    vi.stubEnv('WEAPP_VITE_E2E_TEMPLATE', 'template-b')
    new DomAcceptanceReporter().onTestRunEnd([createModule([createTest('passed')])], [], 'passed')
    const reports = readReports()
    expect(reports).toHaveLength(2)
    expect(new Set(reports.map(report => report.invocationId)).size).toBe(2)
    const task = {
      command: 'node',
      args: [],
      label: 'template-suite',
      acceptanceTemplates: ['template-a', 'template-b'],
      artifacts: fs.readdirSync(reportDir).filter(file => file.endsWith('.json')).map(file => ({ kind: 'dom-acceptance-report' as const, indexPath: path.join(reportDir, file) })),
    }
    const identity = { runId: 'test-run', commitSha }
    const plannedCases = reports.flatMap(report => report.cases.map(({ file, name }) => ({ file, name })))
    await expect(validateTaskAcceptance(task, identity, plannedCases)).resolves.toBeUndefined()
    task.artifacts.pop()
    await expect(validateTaskAcceptance(task, identity)).rejects.toThrow('Template DOM acceptance invocations incomplete')
  })
})
