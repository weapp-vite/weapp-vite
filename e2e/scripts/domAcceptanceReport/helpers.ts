import type { AcceptanceCaseInput, AcceptanceCaseReport, AcceptanceIdentity, AcceptanceReport } from './types'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { assertDomAcceptanceComplete } from '../../utils/domAcceptance/checkpoint'
import { evaluateExpectedErrors } from './expectedErrors'
import { evaluateDiagnosticTimestamps } from './runtimeDiagnostics'
import { evaluateRuntimeVersions } from './runtimeVersions'
import { assertSerializedDomEvidence, serializedReport } from './validation'

export const DOM_ACCEPTANCE_ENV = 'WEAPP_VITE_E2E_DOM_ACCEPTANCE'
export const ACCEPTANCE_RUN_ID_ENV = 'WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID'
export const ACCEPTANCE_SHA_ENV = 'WEAPP_VITE_E2E_ACCEPTANCE_SHA'
export const ACCEPTANCE_DIRTY_ENV = 'WEAPP_VITE_E2E_ACCEPTANCE_DIRTY'
export const ACCEPTANCE_REPORT_DIR_ENV = 'WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR'
export const ACCEPTANCE_TASK_ENV = 'WEAPP_VITE_E2E_ACCEPTANCE_TASK'
export const ACCEPTANCE_ROOT = path.resolve(import.meta.dirname, '../../..')
const GENERATED_ACCEPTANCE_EVIDENCE_PREFIX = 'docs/reports/dom-acceptance/'
const GENERATED_SUITE_REPORT_FILE = /^docs\/reports\/\d{4}-\d{2}-\d{2}-\d{6}-[\w.](?:[\w.-]*[\w.])?-suite-report\/index\.(?:md|json)$/

export function isStrictDomAcceptance(env = process.env) {
  return env[DOM_ACCEPTANCE_ENV] === '1'
}

export function isStrictDomAcceptanceSuite(suiteName: string, env = process.env) {
  const mode = suiteName.replace(/^e2e:/, '').split(/\s+/)[0]
  return mode === 'ide-full' || mode === 'ide-full:exhaustive' || mode === 'ide-dom-headless' || isStrictDomAcceptance(env)
}

function readGitOutput(args: string[]) {
  return execFileSync('git', args, { cwd: ACCEPTANCE_ROOT, encoding: 'utf8' })
}

export function createAcceptanceIdentity(env = process.env, readGit = readGitOutput): AcceptanceIdentity {
  let commitSha = 'unknown'
  let workingTreeDirty: boolean | null = env[ACCEPTANCE_DIRTY_ENV] === '1' ? true : env[ACCEPTANCE_DIRTY_ENV] === '0' ? false : null
  try {
    commitSha = readGit(['rev-parse', 'HEAD']).trim()
  }
  catch {
    commitSha = 'unknown'
  }
  if (env[ACCEPTANCE_SHA_ENV] && env[ACCEPTANCE_SHA_ENV] !== commitSha) {
    throw new Error('DOM acceptance commit SHA does not match the current checkout')
  }
  if (env[ACCEPTANCE_DIRTY_ENV] === undefined) {
    try {
      const trackedChanges = readGit(['status', '--porcelain', '--untracked-files=no'])
      // 只排除未跟踪的生成证据；同目录内已提交文件的变更仍属于工作区改动。
      workingTreeDirty = Boolean(trackedChanges) || readGit(['ls-files', '--others', '--exclude-standard', '-z'])
        .split('\0')
        .some(file => file && !file.startsWith(GENERATED_ACCEPTANCE_EVIDENCE_PREFIX) && !GENERATED_SUITE_REPORT_FILE.test(file))
    }
    catch {
      workingTreeDirty = null
    }
  }
  return { runId: env[ACCEPTANCE_RUN_ID_ENV] || randomUUID(), commitSha, workingTreeDirty }
}

export function sanitizeAcceptanceText(value: string, root = ACCEPTANCE_ROOT, home = os.homedir()) {
  let result = value.replaceAll('\\', '/')
  for (const [prefix, replacement] of [[root, '<repo>'], [home, '<home>']]) {
    const normalized = prefix!.replaceAll('\\', '/').replace(/\/$/, '')
    if (normalized) {
      result = result.replaceAll(normalized, replacement!)
    }
  }
  return result
    .replace(/(?<![\w/])(?:[A-Z]:)?\/(?:Users|home)\/[^\s/"'<>]+/gi, '<home>')
    .replace(/(?<![\w/])(?:[A-Z]:\/|\/(?:private|var|tmp|Applications|opt)\/)[^\s"'<>)]*/gi, '<external-path>')
    .replace(/\b(?:Bearer\s+|(?:token|password|secret|appid)\s*[=:]\s*)[^\s,"'<>]+/gi, '<redacted>')
    .replace(/\b[\w.%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<email>')
}

export function sanitizeAcceptanceValue<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeAcceptanceText(value) as T
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeAcceptanceValue(item)) as T
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      /^(?:token|accessToken|authorization|password|secret|sessionKey|appid|openid|unionid)$/i.test(key)
        ? '<redacted>'
        : (key === 'route' || key === 'id') && typeof entry === 'string' ? entry : sanitizeAcceptanceValue(entry),
    ])) as T
  }
  return value
}

export function evaluateAcceptanceCase(input: AcceptanceCaseInput): AcceptanceCaseReport {
  const violations: string[] = []
  try {
    assertDomAcceptanceComplete(input.acceptance)
    assertSerializedDomEvidence(input.acceptance!)
    if (input.acceptance?.failures?.length) {
      violations.push('DOM checkpoint failures were recorded during this case')
    }
    if (input.acceptance?.evidence.some(item => !Number.isFinite(Date.parse(item.capturedAt)))) {
      violations.push('DOM evidence has an invalid capture timestamp')
    }
    if (input.startedAt !== undefined && input.acceptance?.evidence.some(item => Date.parse(item.capturedAt) < input.startedAt!)) {
      violations.push('DOM evidence predates the current case execution')
    }
    if (input.finishedAt !== undefined && input.acceptance?.evidence.some(item => Date.parse(item.capturedAt) > input.finishedAt!)) {
      violations.push('DOM evidence was captured after the case finished')
    }
    const times = input.acceptance?.evidence.map(item => Date.parse(item.capturedAt)) ?? []
    if (times.some((time, index) => index > 0 && time < times[index - 1]!)) {
      violations.push('DOM evidence timestamps are not in checkpoint order')
    }
  }
  catch (error) {
    violations.push(error instanceof Error ? error.message : String(error))
  }
  const status = input.state === 'pending'
    ? 'not-executed'
    : input.state === 'skipped'
      ? 'skipped'
      : input.state === 'failed'
        ? 'failed'
        : violations.length > 0 ? 'blocked' : 'passed'
  return { ...input, status, violations }
}

export function summarizeAcceptanceCases(cases: AcceptanceCaseReport[]): AcceptanceReport['summary'] {
  return {
    plannedCount: cases.length,
    executedCount: cases.filter(item => item.state === 'passed' || item.state === 'failed').length,
    passedCount: cases.filter(item => item.status === 'passed').length,
    failedCount: cases.filter(item => item.status === 'failed').length,
    blockedCount: cases.filter(item => item.status === 'blocked').length,
    skippedCount: cases.filter(item => item.status === 'skipped').length,
    notExecutedCount: cases.filter(item => item.status === 'not-executed').length,
    plannedCheckpointCount: cases.reduce((count, item) => count + (item.acceptance?.checkpoints.length ?? 0), 0),
    capturedCheckpointCount: cases.reduce((count, item) => count + (item.acceptance?.evidence.length ?? 0), 0),
  }
}

export function assertAcceptanceReportPassed(value: unknown, identity: AcceptanceIdentity): asserts value is AcceptanceReport {
  const parsed = serializedReport.safeParse(value)
  if (!parsed.success) {
    throw new Error('DOM acceptance did not finish with a valid serialized report', { cause: parsed.error })
  }
  const report = parsed.data as AcceptanceReport
  if (report.schemaVersion !== 1 || report.runId !== identity.runId || report.commitSha !== identity.commitSha || report.commitSha === 'unknown') {
    throw new Error('DOM acceptance report identity does not match the current run')
  }
  if (report.status !== 'passed' || !report.strict || !report.finishedAt || !report.cases.length || report.errors.length
    || evaluateExpectedErrors(report.cases, report.runtimeDiagnostics ?? []).length) {
    throw new Error('DOM acceptance did not finish all collected cases successfully')
  }
  const metadataErrors = [
    ...evaluateRuntimeVersions(report.cases, report.provider, report.environment),
    ...evaluateDiagnosticTimestamps(report.runtimeDiagnostics ?? []),
  ]
  if (metadataErrors.length) {
    throw new Error(`DOM acceptance metadata incomplete: ${metadataErrors.join('; ')}`)
  }
  const start = Date.parse(report.startedAt)
  const end = Date.parse(report.finishedAt)
  if (start > end || new Set(report.cases.map(item => item.id)).size !== report.cases.length) {
    throw new Error('DOM acceptance report has an invalid time window or duplicate case IDs')
  }
  for (const item of report.cases) {
    if (evaluateAcceptanceCase(item).status !== 'passed' || item.status !== 'passed' || item.violations.length
      || item.acceptance?.provider !== report.provider || item.startedAt! < start || item.finishedAt! > end || item.startedAt! > item.finishedAt!) {
      throw new Error(`DOM acceptance incomplete: ${item.file} > ${item.name}`)
    }
  }
  if (!isDeepStrictEqual(summarizeAcceptanceCases(report.cases), report.summary)) {
    throw new Error('DOM acceptance summary does not match its case evidence')
  }
}
