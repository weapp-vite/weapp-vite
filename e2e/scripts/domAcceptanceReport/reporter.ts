import type { Reporter, TestCase, TestModule, TestRunEndReason } from 'vitest/node'
import type { DomAcceptance } from '../../utils/domAcceptance/types'
import type { AcceptanceCaseInput, AcceptanceReport } from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { evaluateExpectedErrors } from './expectedErrors'
import {
  ACCEPTANCE_REPORT_DIR_ENV,
  ACCEPTANCE_ROOT,
  ACCEPTANCE_TASK_ENV,
  createAcceptanceIdentity,
  evaluateAcceptanceCase,
  isStrictDomAcceptance,
  sanitizeAcceptanceValue,
  summarizeAcceptanceCases,
} from './helpers'
import { RuntimeDiagnosticJournal } from './runtimeDiagnostics'

function formatStrictAcceptanceFailure(report: AcceptanceReport) {
  const summary = report.summary
  const reasons = [...new Set([
    ...report.errors,
    ...report.cases.flatMap(item => item.status === 'passed'
      ? []
      : [`${item.name}: ${item.status}`, ...item.violations, ...(item.errors ?? [])]),
  ].map(reason => String(sanitizeAcceptanceValue(reason)).replace(/\s+/g, ' ').trim()))]
  return [
    `Strict DOM acceptance failed: DOM cases ${summary.passedCount}/${summary.plannedCount} passed; checkpoints ${summary.capturedCheckpointCount}/${summary.plannedCheckpointCount} captured; run errors ${report.errors.length}`,
    `Case coverage: failed=${summary.failedCount}, blocked=${summary.blockedCount}, skipped=${summary.skippedCount}, not-executed=${summary.notExecutedCount}`,
    ...reasons.slice(0, 3).map(reason => `- ${reason.length > 600 ? `${reason.slice(0, 600)}…` : reason}`),
    ...(reasons.length > 3 ? [`- ${reasons.length - 3} additional reasons in the DOM acceptance report`] : []),
  ].join('\n')
}

export default class DomAcceptanceReporter implements Reporter {
  private readonly identity = createAcceptanceIdentity()
  private readonly invocationId = randomUUID()
  private readonly startedAt = new Date().toISOString()
  private readonly strict = isStrictDomAcceptance()
  private readonly cases = new Map<string, AcceptanceCaseInput>()
  private readonly startedCases = new Map<string, number>()
  private readonly diagnostics = new RuntimeDiagnosticJournal(process.env.WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE, this.strict)
  private activeCase: string | null = null
  private readonly reportFile = path.join(
    process.env[ACCEPTANCE_REPORT_DIR_ENV] || path.join(ACCEPTANCE_ROOT, 'docs/reports/dom-acceptance', this.identity.runId),
    `${this.invocationId}.json`,
  )

  onTestRunStart() {
    this.persist([], null)
    process.stdout.write(`[dom-acceptance-report] index=${path.relative(ACCEPTANCE_ROOT, this.reportFile).replaceAll('\\', '/')}\n`)
  }

  onTestModuleCollected(module: TestModule) {
    for (const test of module.children.allTests()) {
      this.collect(test)
    }
    this.persist([], null)
  }

  onTestCaseReady(test: TestCase) {
    this.diagnostics.collect(this.activeCase)
    this.activeCase = test.id
    this.startedCases.set(test.id, Date.now())
  }

  onTestCaseResult(test: TestCase) {
    this.diagnostics.collect(test.id)
    this.activeCase = null
    this.collect(test)
    this.persist([], null)
  }

  onTestRunEnd(modules: ReadonlyArray<TestModule>, errors: ReadonlyArray<{ message: string }>, reason: TestRunEndReason) {
    const messages = errors.map(error => error.message)
    for (const module of modules) {
      messages.push(...module.errors().map(error => error.message))
      if (!module.children.allTests().next().value) {
        messages.push(`No cases collected in ${module.relativeModuleId}`)
      }
      for (const suite of module.children.allSuites()) {
        messages.push(...suite.errors().map(error => error.message))
      }
      for (const test of module.children.allTests()) {
        this.collect(test)
      }
    }
    if (reason !== 'passed') {
      messages.push(`Vitest run ended: ${reason}`)
    }
    const report = this.persist(messages, new Date().toISOString())
    if (this.strict && report.status !== 'passed') {
      process.exitCode = 1
      throw new Error(formatStrictAcceptanceFailure(report))
    }
  }

  private collect(test: TestCase) {
    const result = test.result()
    const metadata = test.meta() as { domAcceptance?: DomAcceptance }
    this.cases.set(test.id, {
      id: test.id,
      file: test.module.relativeModuleId.replaceAll('\\', '/'),
      name: test.fullName,
      state: result.state,
      acceptance: metadata.domAcceptance,
      errors: result.errors?.map(error => error.message),
      startedAt: test.diagnostic()?.startTime ?? this.startedCases.get(test.id),
      finishedAt: result.state === 'passed' || result.state === 'failed' ? this.cases.get(test.id)?.finishedAt ?? Date.now() : undefined,
    })
  }

  private persist(errors: string[], finishedAt: string | null): AcceptanceReport {
    this.diagnostics.collect(this.activeCase, Boolean(finishedAt))
    errors = [...errors, ...this.diagnostics.errors, ...(finishedAt ? evaluateExpectedErrors([...this.cases.values()], this.diagnostics.entries) : [])]
    const cases = [...this.cases.values()].map(evaluateAcceptanceCase)
    const summary = summarizeAcceptanceCases(cases)
    const report: AcceptanceReport = {
      schemaVersion: 1,
      ...this.identity,
      invocationId: this.invocationId,
      taskLabel: process.env[ACCEPTANCE_TASK_ENV] || process.env.WEAPP_VITE_E2E_TARGET_FILE || 'direct-vitest',
      template: process.env.WEAPP_VITE_E2E_TEMPLATE || null,
      provider: process.env.WEAPP_VITE_E2E_RUNTIME_PROVIDER === 'headless' ? 'headless' : 'devtools',
      environment: {
        nodeVersion: process.version,
        ideVersion: cases.find(item => item.acceptance?.runtime)?.acceptance?.runtime?.ideVersion ?? null,
        baseLibraryVersion: cases.find(item => item.acceptance?.runtime)?.acceptance?.runtime?.baseLibraryVersion ?? null,
      },
      strict: this.strict,
      startedAt: this.startedAt,
      finishedAt,
      status: !finishedAt
        ? 'not-executed'
        : errors.length || summary.failedCount
          ? 'failed'
          : !cases.length || summary.passedCount !== summary.plannedCount ? 'blocked' : 'passed',
      errors,
      runtimeDiagnostics: this.diagnostics.entries,
      cases,
      summary,
    }
    fs.mkdirSync(path.dirname(this.reportFile), { recursive: true })
    const pendingFile = `${this.reportFile}.pending`
    fs.writeFileSync(pendingFile, `${JSON.stringify(sanitizeAcceptanceValue(report), null, 2)}\n`, 'utf8')
    fs.renameSync(pendingFile, this.reportFile)
    return report
  }
}
