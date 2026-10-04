import type { TestCase, TestModule } from 'vitest/node'
import type { AcceptanceReport } from '../../../e2e/scripts/domAcceptanceReport/types'
import type { DomAcceptance } from '../../../e2e/utils/domAcceptance/types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertAcceptanceReportPassed, createAcceptanceIdentity, summarizeAcceptanceCases } from '../../../e2e/scripts/domAcceptanceReport/helpers'
import DomAcceptanceReporter from '../../../e2e/scripts/domAcceptanceReport/reporter'
import { SELECTED_CASES_ENV } from '../../../e2e/scripts/domAcceptanceReport/selectedCases'
import { validateTaskAcceptance } from '../../../e2e/scripts/domAcceptanceReport/task'
import { readPlannedTaskCases } from '../../../e2e/scripts/domAcceptanceReport/taskCases'
import { createConsumerRuntimeEnvironment } from '../scripts/consumerRuntimeEnvironment.mjs'
import { selectClassicRuntimeHost } from '../scripts/consumerRuntimeHost.mjs'
import { createConsumerRuntimeProfile } from '../scripts/consumerRuntimeProfile.mjs'

const repository = path.resolve(import.meta.dirname, '../../..')
const label = 'ide/hmr-auto-classic.runtime.test.ts'
const file = `e2e/${label}`
let reportDir = ''
let commitSha = ''

beforeEach(() => {
  reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-classic-report-'))
  commitSha = createAcceptanceIdentity({}).commitSha
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR', reportDir)
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID', 'consumer-report-test')
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_SHA', commitSha)
  vi.stubEnv('WEAPP_VITE_E2E_DOM_ACCEPTANCE', '1')
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_TASK', label)
  vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
  vi.stubEnv('WEAPP_VITE_E2E_CLASSIC_PROJECT', reportDir)
  vi.stubEnv('WEAPP_VITE_E2E_COMPILER_HOST', 'vite-plus')
  vi.stubEnv(SELECTED_CASES_ENV, undefined)
  const journal = path.join(reportDir, 'runtime.jsonl')
  fs.writeFileSync(journal, '')
  vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', journal)
})

afterEach(() => {
  fs.rmSync(reportDir, { recursive: true, force: true })
  process.exitCode = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// 只执行真实 suite 的声明阶段；所有 hook 和 case 回调均不执行，不导入 runtime。
function collectClassicCaseNames() {
  const content = fs.readFileSync(path.join(repository, file), 'utf8')
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  const declaration = source.statements.filter(statement => !ts.isImportDeclaration(statement))
    .map(statement => statement.getText(source))
    .join('\n')
    .replaceAll('import.meta', 'moduleMeta')
  const names: string[] = []
  let suite = ''
  runInNewContext(ts.transpileModule(declaration, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, {
    path,
    process: { env: process.env },
    moduleMeta: { dirname: path.join(repository, 'e2e/ide') },
    selectClassicRuntimeHost,
    describe(name: string, _options: unknown, callback: () => void) {
      suite = name
      callback()
    },
    it(name: string) { names.push(`${suite} > ${name}`) },
    beforeAll() {},
    afterAll() {},
  })
  return names
}

function testCase(name: string, state: 'passed' | 'skipped' = 'passed', moduleFile = file): TestCase {
  const startTime = Date.now()
  const checkpoints = ['initial', 'prepared', 'reloaded', 'updated']
  const provider = process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER === 'devtools' ? 'devtools' : 'headless'
  const acceptance: DomAcceptance = {
    fixture: 'e2e-apps/stateful-hmr',
    provider,
    runtime: { ideVersion: '2.02.2608080', baseLibraryVersion: '3.17.3' },
    checkpoints: checkpoints.map(id => ({ id, action: id, route: '/pages/native/index', nodes: [{ selector: '.marker', text: id }] })),
    evidence: checkpoints.map(id => ({ id, route: 'pages/native/index', source: provider === 'headless' ? 'headless-logical-tree' : 'devtools-page-frame', capturedAt: new Date().toISOString(), nodes: [{ selector: '.marker', query: 'css', count: 1, nodes: [{ text: id }] }] })),
  }
  return {
    id: name,
    fullName: name,
    module: { relativeModuleId: moduleFile },
    result: () => ({ state }),
    meta: () => state === 'passed' ? { domAcceptance: acceptance } : {},
    diagnostic: () => ({ startTime }),
  } as unknown as TestCase
}

function testModule(tests: TestCase[]): TestModule {
  return {
    relativeModuleId: file,
    errors: () => [],
    children: { allTests: () => tests.values(), allSuites: () => [].values() },
  } as unknown as TestModule
}

function readReport() {
  const reportFile = fs.readdirSync(reportDir).find(entry => entry.endsWith('.json'))!
  return { indexPath: path.join(reportDir, reportFile), value: JSON.parse(fs.readFileSync(path.join(reportDir, reportFile), 'utf8')) as AcceptanceReport }
}

describe.each([
  ['classic', 'headless'],
  ['classic-watch', 'headless'],
  ['classic', 'devtools'],
  ['classic-watch', 'devtools'],
])('selected Vite+ %s / %s report contract', (profileName, provider) => {
  beforeEach(() => {
    const profile = createConsumerRuntimeProfile(profileName, 'vite-plus', provider)
    const env = { ...createConsumerRuntimeEnvironment(provider, 'vite-plus', profile.projectVariable, reportDir, profile.cases), ...profile.env }
    for (const [name, value] of Object.entries(env)) {
      vi.stubEnv(name, value)
    }
  })

  it('accepts the actual selected declaration in both reporter and task inventory', async () => {
    const names = collectClassicCaseNames()
    const host = profileName === 'classic' ? 'vite-plus' : 'vite-plus-watch'
    expect(names).toEqual([`${host} automatic classic HMR in real WeChat DevTools > uses direct output and reloads the page instead of preserving its state`])
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunEnd([testModule(names.map(name => testCase(name)))], [], 'passed')
    const report = readReport()
    expect(report.value).toMatchObject({ status: 'passed', summary: { plannedCount: 1, passedCount: 1, skippedCount: 0, plannedCheckpointCount: 4, capturedCheckpointCount: 4 } })
    await expect(validateTaskAcceptance({
      label,
      command: 'node',
      args: [],
      artifacts: [{ kind: 'dom-acceptance-report', indexPath: report.indexPath }],
    }, { runId: 'consumer-report-test', commitSha })).resolves.toBeUndefined()
  })

  it('rejects a selected case skipped before registering DOM metadata', () => {
    const reporter = new DomAcceptanceReporter()
    const names = collectClassicCaseNames()
    expect(() => reporter.onTestRunEnd([testModule(names.map(name => testCase(name, 'skipped')))], [], 'passed')).toThrow('Strict DOM acceptance failed')
    expect(readReport().value.status).not.toBe('passed')
  })

  it('rejects a substituted host even with complete DOM evidence and matching counts', () => {
    const reporter = new DomAcceptanceReporter()
    const wrongHost = collectClassicCaseNames()[0]!.replace(/^vite-plus/, 'vite')
    expect(() => reporter.onTestRunEnd([testModule([testCase(wrongHost)])], [], 'passed')).toThrow('Selected DOM case did not pass exactly once')
    const report = readReport().value
    expect(report.summary.passedCount).toBe(1)
    expect(report.status).toBe('failed')
    report.status = 'passed'
    report.errors = []
    expect(() => assertAcceptanceReportPassed(report, { runId: 'consumer-report-test', commitSha })).toThrow('Selected DOM case did not pass exactly once')
  })

  it('allows only unselected cases to remain skipped without metadata', async () => {
    const reporter = new DomAcceptanceReporter()
    const selected = collectClassicCaseNames()[0]!
    reporter.onTestRunEnd([testModule([testCase(selected), testCase('unselected workspace host', 'skipped')])], [], 'passed')
    const report = readReport()
    expect(report.value.summary).toMatchObject({ plannedCount: 1, passedCount: 1, skippedCount: 1 })
    await expect(validateTaskAcceptance({ label, command: 'node', args: [], artifacts: [{ kind: 'dom-acceptance-report', indexPath: report.indexPath }] }, { runId: 'consumer-report-test', commitSha })).resolves.toBeUndefined()
  })

  it('rejects a report whose declared selection was removed before task validation', async () => {
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunEnd([testModule(collectClassicCaseNames().map(name => testCase(name)))], [], 'passed')
    const report = readReport()
    delete report.value.selectedCases
    fs.writeFileSync(report.indexPath, JSON.stringify(report.value))
    await expect(validateTaskAcceptance({ label, command: 'node', args: [], artifacts: [{ kind: 'dom-acceptance-report', indexPath: report.indexPath }] }, { runId: 'consumer-report-test', commitSha })).rejects.toThrow('does not match the selected case plan')
  })
})

describe('nonempty and complete consumer reports', () => {
  it('rejects zero planned cases in both reporter and serialized validation without a selected plan', () => {
    const reporter = new DomAcceptanceReporter()
    expect(() => reporter.onTestRunEnd([testModule([testCase('filtered case', 'skipped')])], [], 'passed')).toThrow('Strict DOM acceptance failed')
    const report = readReport().value
    expect(report.summary).toMatchObject({ plannedCount: 0, passedCount: 0, skippedCount: 1 })
    report.status = 'passed'
    report.errors = []
    expect(() => assertAcceptanceReportPassed(report, { runId: 'consumer-report-test', commitSha })).toThrow('did not finish all collected cases')
  })

  it.each(['missing', 'skipped', 'duplicate', 'wrong-file'])('rejects a %s selected React child while other selected cases pass', (failure) => {
    const profile = createConsumerRuntimeProfile('react', 'vite-plus', 'headless')
    vi.stubEnv(SELECTED_CASES_ENV, JSON.stringify(profile.cases))
    const reporter = new DomAcceptanceReporter()
    const tests = profile.cases.map(item => testCase(item.name, 'passed', item.file))
    if (failure === 'missing') {
      tests.pop()
    }
    if (failure === 'skipped') {
      tests[2] = testCase(profile.cases[2]!.name, 'skipped', profile.file)
    }
    if (failure === 'duplicate') {
      const duplicate = testCase(profile.cases[0]!.name, 'passed', profile.file)
      Object.defineProperty(duplicate, 'id', { value: 'duplicate' })
      tests.push(duplicate)
    }
    if (failure === 'wrong-file') {
      tests[2] = testCase(profile.cases[2]!.name, 'passed', file)
    }
    expect(() => reporter.onTestRunEnd([testModule(tests)], [], 'passed')).toThrow('Selected DOM case did not pass exactly once')
    expect(readReport().value.status).toBe('failed')
  })

  it('revalidates omitted selected children after a serialized report summary is recomputed', () => {
    const profile = createConsumerRuntimeProfile('react', 'vite-plus', 'headless')
    vi.stubEnv(SELECTED_CASES_ENV, JSON.stringify(profile.cases))
    const reporter = new DomAcceptanceReporter()
    reporter.onTestRunEnd([testModule(profile.cases.map(item => testCase(item.name, 'passed', item.file)))], [], 'passed')
    const report = readReport().value
    report.cases.pop()
    report.summary = summarizeAcceptanceCases(report.cases)
    expect(() => assertAcceptanceReportPassed(report, { runId: 'consumer-report-test', commitSha })).toThrow('Selected DOM case did not pass exactly once')
  })

  it('retains the default three-host inventory without a consumer selection', async () => {
    const planned = await readPlannedTaskCases({ label, command: 'node', args: [] }, 'headless')
    expect(planned.map(item => item.name.split(' ')[0])).toEqual(['wv', 'vite', 'vite-watch'])
  })

  it.each(['[]', '{}', 'not-json'])('rejects malformed or empty declared plans: %s', (serialized) => {
    vi.stubEnv(SELECTED_CASES_ENV, serialized)
    expect(() => new DomAcceptanceReporter()).toThrow()
  })
})
