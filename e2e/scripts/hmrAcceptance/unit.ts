/* eslint-disable e18e/ban-dependencies -- 独立单测必须保留跨平台 pnpm 启动和原始输出。 */
import type { AcceptanceIdentity } from '../domAcceptanceReport/types'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { DOM_ACCEPTANCE_ENV, sanitizeAcceptanceValue } from '../domAcceptanceReport/helpers'
import { createVerificationIdentity } from '../verification/plan'

export interface HmrUnitSummary {
  testFiles: number
  totalTests: number
  passedTests: number
  failedTests: number
  pendingTests: number
  todoTests: number
}

export interface HmrUnitReceipt extends AcceptanceIdentity {
  schemaVersion: 1
  kind: 'hmr-unit-receipt'
  command: ['pnpm', 'test:hmr']
  status: 'passed' | 'failed'
  exitCode: number | null
  startedAt: string
  finishedAt: string
  artifacts: { stdout: string, stderr: string, vitest: string }
  summary?: HmrUnitSummary
  error?: string
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** 读取 Vitest 的实际 JSON 结果，拒绝空成功、跳过和与逐项用例不一致的计数。 */
export function summarizeHmrUnitResults(value: unknown): HmrUnitSummary {
  const report = record(value)
  const testFiles = Array.isArray(report?.testResults) ? report.testResults.map(record) : []
  const assertions = testFiles.flatMap(file => Array.isArray(file?.assertionResults) ? file.assertionResults.map(record) : [])
  const summary = {
    testFiles: testFiles.length,
    totalTests: report?.numTotalTests,
    passedTests: report?.numPassedTests,
    failedTests: report?.numFailedTests,
    pendingTests: report?.numPendingTests,
    todoTests: report?.numTodoTests ?? 0,
  }
  if (report?.success !== true || !testFiles.length || !assertions.length
    || Object.values(summary).some(count => !Number.isInteger(count) || (count as number) < 0)
    || summary.totalTests !== assertions.length || summary.passedTests !== summary.totalTests
    || summary.failedTests !== 0 || summary.pendingTests !== 0 || summary.todoTests !== 0
    || testFiles.some(file => file?.status !== 'passed' || !Array.isArray(file.assertionResults) || !file.assertionResults.length)
    || assertions.some(assertion => assertion?.status !== 'passed')) {
    throw new Error('HMR unit validation requires a non-empty complete passing Vitest JSON report')
  }
  return summary as HmrUnitSummary
}

/** 综合验收不接受单靠退出码或其他提交的单测收据。 */
export function assertHmrUnitReceipt(receipt: HmrUnitReceipt | undefined, identity: AcceptanceIdentity): asserts receipt is HmrUnitReceipt {
  const summary = receipt?.summary
  if (!receipt || receipt.schemaVersion !== 1 || receipt.kind !== 'hmr-unit-receipt'
    || receipt.status !== 'passed' || receipt.exitCode !== 0
    || !Array.isArray(receipt.command) || receipt.command.join(' ') !== 'pnpm test:hmr'
    || receipt.runId !== identity.runId || receipt.commitSha !== identity.commitSha || receipt.workingTreeDirty !== false
    || !summary || [summary.testFiles, summary.totalTests, summary.passedTests, summary.failedTests, summary.pendingTests, summary.todoTests]
    .some(count => !Number.isInteger(count) || count < 0)
    || summary.testFiles < 1 || summary.totalTests < 1 || summary.testFiles > summary.totalTests || summary.passedTests !== summary.totalTests
    || summary.failedTests !== 0 || summary.pendingTests !== 0 || summary.todoTests !== 0
    || !receipt.artifacts || [receipt.artifacts.stdout, receipt.artifacts.stderr, receipt.artifacts.vitest].some(file => typeof file !== 'string' || !file)) {
    throw new Error('Full HMR acceptance requires successful non-empty unit evidence from the same clean commit and run')
  }
}

function assertCheckout(identity: AcceptanceIdentity) {
  const current = createVerificationIdentity()
  if (identity.workingTreeDirty !== false || current.workingTreeDirty !== false || current.commitSha !== identity.commitSha) {
    throw new Error('HMR unit validation checkout changed or is not clean')
  }
}

/** 子进程借用外层租约；退出并保存原始结果后才允许开始 E2E 阶段。 */
export async function runHmrUnitValidation(options: {
  repositoryRoot: string
  directory: string
  identity: AcceptanceIdentity
  environment: NodeJS.ProcessEnv
}): Promise<HmrUnitReceipt> {
  const { directory, identity } = options
  const startedAt = new Date().toISOString()
  const artifacts = { stdout: 'unit/stdout.log', stderr: 'unit/stderr.log', vitest: 'unit/vitest.json' }
  const reportFile = path.join(directory, 'vitest.json')
  let stdout = ''
  let stderr = ''
  let exitCode: number | null = null
  let summary: HmrUnitSummary | undefined
  await fs.mkdir(directory, { recursive: true })
  try {
    assertCheckout(identity)
    await fs.rm(reportFile, { force: true })
    const result = await execa('pnpm', [
      'test:hmr',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${reportFile}`,
    ], {
      cwd: options.repositoryRoot,
      env: { ...process.env, ...options.environment, [DOM_ACCEPTANCE_ENV]: '0', WEAPP_VITE_E2E_RUNTIME_PROVIDER: undefined },
      extendEnv: false,
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    })
    stdout = result.stdout
    stderr = result.stderr
    exitCode = result.exitCode ?? null
    if (exitCode !== 0) {
      throw new Error(`HMR unit validation failed with exit code ${exitCode ?? 'unknown'}`)
    }
    summary = summarizeHmrUnitResults(JSON.parse(await fs.readFile(reportFile, 'utf8')) as unknown)
    assertCheckout(identity)
    const receipt: HmrUnitReceipt = {
      schemaVersion: 1,
      kind: 'hmr-unit-receipt',
      ...identity,
      command: ['pnpm', 'test:hmr'],
      status: 'passed',
      exitCode,
      startedAt,
      finishedAt: new Date().toISOString(),
      artifacts,
      summary,
    }
    assertHmrUnitReceipt(receipt, identity)
    await fs.writeFile(path.join(directory, 'receipt.json'), `${JSON.stringify(sanitizeAcceptanceValue(receipt), null, 2)}\n`)
    return receipt
  }
  catch (error) {
    const failure = record(error)
    stdout ||= typeof failure?.stdout === 'string' ? failure.stdout : ''
    stderr ||= typeof failure?.stderr === 'string' ? failure.stderr : ''
    const receipt: HmrUnitReceipt = {
      schemaVersion: 1,
      kind: 'hmr-unit-receipt',
      ...identity,
      command: ['pnpm', 'test:hmr'],
      status: 'failed',
      exitCode,
      startedAt,
      finishedAt: new Date().toISOString(),
      artifacts,
      summary,
      error: error instanceof Error ? error.message : String(error),
    }
    await fs.writeFile(path.join(directory, 'receipt.json'), `${JSON.stringify(sanitizeAcceptanceValue(receipt), null, 2)}\n`)
    throw error
  }
  finally {
    await Promise.all([
      fs.writeFile(path.join(directory, 'stdout.log'), stdout),
      fs.writeFile(path.join(directory, 'stderr.log'), stderr),
    ])
  }
}
