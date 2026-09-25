import type { AuditSample, Checkout } from './collect'
import type { AuditBatch } from './report'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { autoImportMetrics, collectAutoImport } from './autoImport'
import { collectBuilds, collectHmr, prepareCheckouts } from './collect'
import { assertGatePassed, evaluateGate } from './evaluate'
import { autoImportFeatureCosts, renderFeatureCosts } from './featureCosts'
import { assertManifestMetrics, discoverManifest } from './manifest'
import { createAuditReport, evaluateAuditGate, pairBatch, renderGate } from './report'

const driver = path.resolve(import.meta.dirname, '../..')
const output = path.resolve(process.env.TEMPLATES_PERF_REPORT_DIR ?? '.tmp/paired-performance')
const runtimes = ['classic', 'stateful-experimental']
await mkdir(output, { recursive: true })
const checkouts = await prepareCheckouts(driver, output)
const manifest = await discoverManifest(checkouts, driver, output)
manifest.metrics.push(...autoImportMetrics())

async function collectBatch(name: string, selected?: Set<string>) {
  const batch: AuditBatch = { samples: [], errors: [] }
  const checkpoint = () => writeFile(path.join(output, `${name}.json`), JSON.stringify(batch, null, 2))
  async function sample(kind: string, count: number, collect: (checkout: Checkout, dir: string) => Promise<AuditSample[]>) {
    if (selected && ![...selected].some(id => id.startsWith(kind))) {
      return
    }
    // 诊断可减少轮次，但完整性检查仍要求 7/20 对，绝不把诊断运行标成通过。
    const limit = Math.min(count, Number(process.env.TEMPLATES_PERF_DIAGNOSTIC_PAIRS ?? count))
    for (let round = 0; round < limit; round++) {
      for (const side of round % 2 === 0 ? ['baseline', 'optimized'] as const : ['optimized', 'baseline'] as const) {
        const dir = path.join(output, name, kind.replaceAll(':', '-'), String(round), side)
        console.log(`[paired-perf] ${name} ${kind} ${round + 1}/${count} ${side}`)
        try {
          const values = await collect(checkouts[side], dir)
          batch.samples.push({ round, side, values: selected ? values.filter(value => selected.has(value.id)) : values })
        }
        catch (error) {
          batch.errors.push(`${name} ${kind} pair ${round + 1} ${side}: ${String(error).replaceAll(checkouts[side].cwd, '<checkout>').replaceAll(driver, '<driver>')}`)
          await checkpoint()
          return false
        }
        await checkpoint()
      }
    }
    return true
  }
  await sample('build:', 7, collectBuilds)
  for (const runtime of runtimes) {
    await sample(`hmr:${runtime}:`, 20, (checkout, dir) => collectHmr(checkout, driver, dir, runtime))
  }
  await sample('auto-build:', 7, (checkout, dir) => collectAutoImport(checkout, driver, dir, 'build'))
  await sample('auto-hmr:', 20, (checkout, dir) => collectAutoImport(checkout, driver, dir, 'hmr'))
  return batch
}

const primary = await collectBatch('primary')
try {
  assertManifestMetrics(manifest, pairBatch(primary).map(row => row.id))
}
catch (error) {
  primary.errors.push(String(error))
}
const primaryScenarios = pairBatch(primary)
const initial = evaluateGate(primaryScenarios)
const eligible = new Set(primaryScenarios.filter(row => !row.error && row.pairs.length === row.requiredPairs).map(row => row.id))
const exceeded = new Set(initial.scenarios.filter(row => eligible.has(row.id) && row.primary.changePercent !== null && row.primary.changePercent > 5).map(row => row.id))
const confirmation = exceeded.size && !process.env.TEMPLATES_PERF_DIAGNOSTIC_PAIRS
  ? await collectBatch('confirmation', exceeded)
  : undefined
const gate = evaluateAuditGate(primary, confirmation)
const featureCosts = autoImportFeatureCosts(primary)
const report = { ...createAuditReport(checkouts, primary, confirmation, gate), manifest, featureCosts }
await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
const markdown = [
  `基线：\`${checkouts.baseline.commit}\`；当前：\`${checkouts.optimized.commit}\`。`,
  `环境：${process.platform}/${process.arch}，Node ${process.version}；同一驱动、交替串行、产物确认计时。`,
  '',
  renderGate(gate),
  ...primary.errors.length || confirmation?.errors.length
    ? ['', '采集失败（总门禁不可通过）：', ...[...primary.errors, ...confirmation?.errors ?? []].map(error => `- ${error.replaceAll('\n', ' ')}`)]
    : [],
  renderFeatureCosts(featureCosts),
].join('\n')
await writeFile(path.join(output, 'report.md'), markdown)
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, { flag: 'a' })
}
console.log(markdown)
assertGatePassed(gate)
