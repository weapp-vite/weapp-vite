import type { TestCase, TestModule } from 'vitest/node'
import type { VerificationTiming } from '../../e2e/scripts/verification/types'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import DomAcceptanceReporter from '../../e2e/scripts/domAcceptanceReport/reporter'

// reporter 时钟契约不加载已构建 CLI，也不查询安装或官方版本。
vi.mock('../../e2e/utils/devtoolsSelection', () => ({
  ACCEPTED_DEVTOOLS_VERSION_ENV: 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION',
  readDevtoolsVersionPolicy: () => undefined,
}))

let reportDir: string

beforeEach(() => {
  reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-timing-'))
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR', reportDir)
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID', 'timing-unit')
  vi.stubEnv('WEAPP_VITE_E2E_ACCEPTANCE_SHA', undefined)
  vi.stubEnv('WEAPP_VITE_E2E_DOM_ACCEPTANCE', '0')
  vi.stubEnv('WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE', undefined)
  vi.stubEnv('WEAPP_VITE_E2E_TIMING_FILE', path.join(reportDir, 'timings.jsonl'))
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(() => {
  fs.rmSync(reportDir, { recursive: true, force: true })
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function createTest(name: string, startTime: number, duration: number): TestCase {
  return {
    id: name,
    fullName: name,
    module: { relativeModuleId: 'e2e/ide/example.test.ts' },
    result: () => ({ state: 'passed' }),
    meta: () => ({}),
    diagnostic: () => ({ startTime, duration }),
  } as unknown as TestCase
}

function createModule(tests: TestCase[]): TestModule {
  return {
    relativeModuleId: 'e2e/ide/example.test.ts',
    errors: () => [],
    children: { allTests: () => tests.values(), allSuites: () => [].values() },
  } as unknown as TestModule
}

function readTimings(): VerificationTiming[] {
  return fs.readFileSync(path.join(reportDir, 'timings.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as VerificationTiming)
}

it('connects reporter hooks to actual worker durations and logical group totals', () => {
  const origin = Date.parse('2026-10-19T00:00:00.000Z')
  vi.useFakeTimers()
  vi.setSystemTime(origin)
  const reporter = new DomAcceptanceReporter()
  const form = createTest('tdesign > form', origin + 100, 1_620)
  const layout = createTest('tdesign > layout', origin + 3_900, 1_994)
  vi.setSystemTime(origin + 50)
  reporter.onTestCaseReady(form)
  vi.setSystemTime(origin + 3_550)
  reporter.onTestCaseResult(form)
  vi.setSystemTime(origin + 5_900)
  reporter.onTestCaseReady(layout)
  vi.setSystemTime(origin + 5_991)
  reporter.onTestCaseResult(layout)
  reporter.onTestRunEnd([createModule([form, layout])], [], 'passed')
  expect(readTimings().map(({ name, durationMs }) => [name, durationMs])).toEqual([
    ['case:tdesign > form', 1_620],
    ['case:tdesign > layout', 1_994],
    ['case-group:tdesign', 3_614],
  ])
})

it('uses final diagnostics when a completed result callback was not delivered', () => {
  const reporter = new DomAcceptanceReporter()
  const test = createTest('tdesign > completed', Date.now(), 35)
  reporter.onTestCaseReady(test)
  reporter.onTestRunEnd([createModule([test])], [], 'passed')
  expect(readTimings().map(({ status, durationMs }) => [status, durationMs])).toEqual([['passed', 35], ['passed', 35]])
})
