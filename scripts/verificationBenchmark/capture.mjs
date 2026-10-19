import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 实测命令需要跨平台启动、取消与真实退出状态。
import { execa } from 'execa'
import { readChanges } from '../verification/changes.ts'
import { validateSample } from './compare.mjs'
import { artifactSnapshot, evidenceDigest, inputDigest } from './evidence.mjs'

/** 原始 Vitest JSON 必须证明同一测试集合完整执行；不能用进程成功代替测试证据。 */
export function vitestScope(report, root) {
  if (report?.success !== true || report.numFailedTests !== 0 || report.numPendingTests !== 0
    || (report.numTodoTests ?? 0) !== 0 || !report.numTotalTests || report.numPassedTests !== report.numTotalTests
    || !Array.isArray(report.testResults) || !report.testResults.length) {
    throw new Error('Benchmark requires complete successful Vitest JSON evidence')
  }
  const scope = []
  for (const file of report.testResults) {
    const relative = path.relative(root, file.name).replaceAll('\\', '/')
    if (relative.startsWith('../') || path.isAbsolute(relative) || !file.assertionResults?.length) {
      throw new Error('Vitest benchmark evidence does not belong to the measured workspace')
    }
    for (const assertion of file.assertionResults) {
      if (assertion.status !== 'passed' || typeof assertion.fullName !== 'string' || !assertion.fullName) {
        throw new Error('Vitest benchmark contains skipped or failed assertions')
      }
      scope.push(`${relative}:${assertion.fullName}`)
    }
  }
  if (scope.length !== report.numTotalTests || new Set(scope).size !== scope.length) {
    throw new Error('Vitest benchmark case inventory is duplicated or incomplete')
  }
  return scope.sort()
}

/** 单轮只运行一个结构化命令，测前测后核对源码；调用者按配对顺序串行采集三轮。 */
export async function captureLocalSample(config, output, root = process.cwd()) {
  if (config?.schemaVersion !== 1 || !Array.isArray(config.args) || !config.command
    || config.args.some(value => typeof value !== 'string')
    || !['baseline', 'candidate'].includes(config.variant) || !config.report || !config.id || !config.cachePolicy) {
    throw new Error('Invalid local benchmark configuration')
  }
  const reportFile = path.resolve(root, config.report)
  const relative = path.relative(root, reportFile)
  if (!relative.startsWith(`.tmp${path.sep}`)) {
    throw new Error('Benchmark evidence must use an owned .tmp report file')
  }
  await mkdir(path.dirname(reportFile), { recursive: true })
  const actualRoot = await realpath(root)
  const actualParent = await realpath(path.dirname(reportFile))
  const actualRelative = path.relative(actualRoot, actualParent)
  if (actualRelative === '..' || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) {
    throw new Error('Benchmark evidence directory escapes its workspace')
  }
  const before = await readChanges(root)
  const inputs = await inputDigest(root, config.inputFiles)
  const artifacts = await artifactSnapshot(root, config.artifactDirectories)
  await rm(reportFile, { force: true })
  const begin = performance.now()
  const result = await execa(config.command, config.args, { cwd: root, stdio: 'inherit', reject: false })
  const executionMs = performance.now() - begin
  const after = await readChanges(root)
  if (before.fingerprint !== after.fingerprint || inputs !== await inputDigest(root, config.inputFiles)
    || JSON.stringify(artifacts) !== JSON.stringify(await artifactSnapshot(root, config.artifactDirectories))) {
    throw new Error('Source, framework input or prepared artifact changed during sampling')
  }
  let scope = []
  let evidenceHash = null
  let error
  try {
    const bytes = await readFile(reportFile, 'utf8')
    evidenceHash = evidenceDigest(bytes)
    scope = vitestScope(JSON.parse(bytes), root)
  }
  catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  const complete = result.exitCode === 0 && !error
  const sample = validateSample({
    schemaVersion: 1,
    id: config.id,
    variant: config.variant,
    revision: before.head,
    sourceFingerprint: before.fingerprint,
    inputDigest: inputs,
    scopeDigest: evidenceDigest(scope),
    profile: { os: process.platform, node: process.version, provider: 'none', platform: 'workspace', runnerClass: 'local', cachePolicy: config.cachePolicy },
    complete,
    outcome: complete ? 'passed' : result.exitCode === 0 ? 'partial' : 'failed',
    metrics: { executionMs, approvalWaitMs: 0, schedulingWaitMs: 0, runnerMs: executionMs },
    evidence: { report: config.report, digest: evidenceHash, artifacts, error, exitCode: result.exitCode },
  })
  await writeFile(output, `${JSON.stringify(sample, null, 2)}\n`)
  return sample
}
