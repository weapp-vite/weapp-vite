import type { Checkout } from './collect'
import type { AuditBatch } from './report'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 校验实际受测与驱动提交身份。
import { execa } from 'execa'
import { collectShardBatch } from './batch'
import { assertSha, metricsForShard, policy } from './contract.mjs'
import { evaluateGate } from './evaluate'
import { autoImportFeatureCosts, renderFeatureCosts } from './featureCosts'
import { discoverManifest } from './manifest'
import { runCollector } from './process'
import { createAuditReport, evaluateAuditGate, pairBatch, renderGate } from './report'

const output = path.resolve(process.env.TEMPLATES_PERF_REPORT_DIR!)
await mkdir(output, { recursive: true })
const plan = JSON.parse(await readFile(process.env.PERFORMANCE_PLAN!, 'utf8'))
const target = plan.targets.find((t: { id: string }) => t.id === process.env.PERFORMANCE_TARGET)
const shard = process.env.PERFORMANCE_SHARD!
const os = process.env.PERFORMANCE_OS!
if (!target || !plan.matrix.some((m: { target: string, shard: string, os: string }) => m.target === target.id && m.shard === shard && m.os === os)) {
  throw new Error('Collector is not in the frozen plan')
}
const metrics: string[] = metricsForShard(shard)
const metadata = { schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: plan.driverSha, headSha: target.headSha, baselineSha: target.baselineSha, targetId: target.id, prNumber: target.prNumber, runId: plan.runId, os, shard }
await writeFile(path.join(output, 'identity.json'), JSON.stringify(metadata))
const deadline = Date.now() + 165 * 60_000
let primary: AuditBatch = { samples: [], errors: [] }
let confirmation: AuditBatch | undefined
let requested: string[] = []
let checkouts: { baseline: Checkout, optimized: Checkout } | undefined
try {
  const driverSha = (await execa('git', ['rev-parse', 'HEAD'])).stdout.trim()
  const platforms: Record<string, string> = { 'ubuntu-latest': 'linux', 'windows-latest': 'win32', 'macos-latest': 'darwin' }
  if (driverSha !== plan.driverSha || process.platform !== platforms[os] || plan.samplingContract !== policy.samplingContract || target.baselineSha !== policy.baselineSha || (process.env.GITHUB_RUN_ATTEMPT && process.env.GITHUB_RUN_ATTEMPT !== '1')) {
    throw new Error('Driver, platform, approved contract or attempt identity mismatch')
  }
  await runCollector(process.execPath, ['--import', 'tsx', 'scripts/performanceGate/prepare.ts'], {
    cwd: process.cwd(),
    logFile: path.join(output, 'preparation.log'),
    timeoutMs: 20 * 60_000,
    env: { PERFORMANCE_PURPOSE: 'full', TEMPLATES_PERF_TEMPLATE_FILTER: policy.templates.map((t: { id: string }) => t.id).join(',') },
  })
  checkouts = JSON.parse(await readFile(path.join(output, 'prepared.json'), 'utf8'))
  if (!checkouts || checkouts.baseline.commit !== assertSha(target.baselineSha) || checkouts.optimized.commit !== assertSha(target.headSha)) {
    throw new Error('Prepared SHA differs from plan')
  }
  const discovered = await discoverManifest(checkouts, process.cwd(), output)
  if (JSON.stringify(discovered.templates) !== JSON.stringify(policy.templates)) {
    throw new Error('Declared scenario lifecycle differs from approved policy')
  }
  primary = await collectShardBatch(checkouts, shard, output, 'primary', deadline)
  const scenarios = pairBatch(primary, metrics)
  requested = evaluateGate(scenarios).scenarios.filter(r => r.primary.changePercent !== null && r.primary.changePercent > 5 && !scenarios.find(s => s.id === r.id)?.error && r.primary.count === (shard === 'build' || shard === 'auto-build' ? 7 : 20)).map(r => r.id)
  await writeFile(path.join(output, 'execution-plan.json'), JSON.stringify({ ...metadata, metrics, confirmation: requested }))
  if (requested.length) {
    confirmation = await collectShardBatch(checkouts, shard, output, 'confirmation', deadline, requested)
  }
}
catch (error) {
  primary.errors.push([process.cwd(), process.env.TEMPLATES_PERF_BASELINE_DIR, process.env.TEMPLATES_PERF_OPTIMIZED_DIR].filter((root): root is string => Boolean(root)).reduce((text, root) => text.replaceAll(root, '<checkout>'), String(error)))
}
const gate = evaluateAuditGate(primary, confirmation, metrics)
const report = { ...(checkouts ? createAuditReport(checkouts, primary, confirmation, gate) : {}), ...metadata, primary, confirmation, gate, manifest: { metrics }, executionPlan: { metrics, confirmation: requested }, featureCosts: autoImportFeatureCosts(primary).filter(row => row.kind === shard) }
await writeFile(path.join(output, 'report.json'), JSON.stringify(report))
const markdown = [renderGate(gate), report.featureCosts.length ? renderFeatureCosts(report.featureCosts) : '', ...primary.errors, ...confirmation?.errors ?? []].join('\n')
await writeFile(path.join(output, 'report.md'), markdown)
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: 'a' })
}
if (gate.status !== 'passed' || report.featureCosts.some(row => row.overFeatureBudget)) {
  process.exitCode = 1
}
