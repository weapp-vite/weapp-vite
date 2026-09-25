import type { AuditSample, Checkout } from './collect'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { collectSide } from './batch'
import { policy, shards, smokeMetrics } from './contract.mjs'
import { discoverManifest } from './manifest'
import { runCollector } from './process'
import { verifySmoke } from './smokeReport.mjs'

const output = path.resolve(process.env.TEMPLATES_PERF_REPORT_DIR!)
await mkdir(output, { recursive: true })
const report = { schemaVersion: 2, purpose: 'smoke', prNumber: Number(process.env.PERFORMANCE_PR_NUMBER), headSha: process.env.PERFORMANCE_HEAD_SHA, driverSha: process.env.PERFORMANCE_HEAD_SHA, baselineSha: policy.baselineSha, samplingContract: policy.samplingContract, executionPlan: { headOnly: true, metrics: shards.flatMap(smokeMetrics), confirmation: [] }, status: 'incomplete', fullAcceptance: 'not-run', stages: [] as Array<{ shard: string, values: AuditSample[] }>, errors: [] as string[] }
const checkpoint = () => writeFile(path.join(output, 'smoke.json'), JSON.stringify(report))
try {
  await runCollector(process.execPath, ['--import', 'tsx', 'scripts/performanceGate/prepare.ts'], {
    cwd: process.cwd(),
    logFile: path.join(output, 'preparation.log'),
    timeoutMs: 6 * 60_000,
    env: { PERFORMANCE_PURPOSE: 'smoke', TEMPLATES_PERF_TEMPLATE_FILTER: policy.templates.map((t: { id: string }) => t.id).join(',') },
  })
  const { optimized } = JSON.parse(await readFile(path.join(output, 'prepared.json'), 'utf8')) as { optimized: Checkout }
  if (optimized.commit !== report.headSha) {
    throw new Error('Smoke checkout SHA mismatch')
  }
  const declared = await discoverManifest({ baseline: optimized, optimized }, process.cwd(), output)
  if (JSON.stringify(declared.templates) !== JSON.stringify(policy.templates)) {
    throw new Error('Smoke scenario manifest mismatch')
  }
  console.log('dist sync: rebuilt weapp-vite before downstream validation')
  const deadline = Date.now() + 5 * 60_000
  for (const shard of shards) {
    const expected: string[] = smokeMetrics(shard)
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error('Smoke collection exceeded five-minute budget')
    }
    console.log(`[performance-smoke] ${shard}`)
    const collected = await collectSide(optimized, shard, path.join(output, shard.replaceAll(':', '-')), expected, Math.min(remaining, 120_000))
    report.stages.push({ shard, values: collected.values })
    await checkpoint()
    if (collected.errors.length) {
      throw new Error(collected.errors.join('; '))
    }
    if (collected.values.length !== expected.length || expected.some(id => collected.values.filter(v => v.id === id && Number.isFinite(v.ms) && v.ms > 0).length !== 1)) {
      throw new Error(`Missing smoke output/lifecycle evidence: ${shard}`)
    }
  }
  report.status = 'passed'
  verifySmoke(report, report.headSha)
}
catch (error) {
  report.status = 'incomplete'
  report.errors.push(String(error).replaceAll(process.cwd(), '<checkout>'))
  process.exitCode = 1
}
finally {
  await checkpoint()
  const text = `## Performance Smoke\n\n${report.status === 'passed' ? '✅ 正确性冒烟通过' : '🔴 正确性冒烟失败'}；完整性能验收未运行。本任务不计算 5% 门禁，不执行等量确认。\n\nHEAD: \`${report.headSha}\`\n\n${report.errors.join('\n')}\n`
  await writeFile(path.join(output, 'smoke.md'), text)
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, text, { flag: 'a' })
  }
}
