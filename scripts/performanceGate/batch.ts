import type { AuditSample, Checkout } from './collect'
import type { AuditBatch } from './report'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { confirmationConfigurations } from './contract.mjs'
import { runCollector } from './process'

export function pairsForShard(shard: string) {
  return shard === 'build' || shard === 'auto-build' ? 7 : 20
}

/** 配置选择发生于子进程启动前，模板内部场景与自动导入生命周期不裁剪。 */
export async function collectSide(checkout: Checkout, shard: string, directory: string, selected?: string[], timeoutMs = 15 * 60_000) {
  await mkdir(directory, { recursive: true })
  const templates = shard.startsWith('hmr:') ? checkout.templates.filter(t => t.id === shard.split(':')[2]) : checkout.templates
  const configurations = selected && shard.startsWith('auto-') ? confirmationConfigurations(selected).map((id: string) => id.split(':').slice(1).join(':')) : undefined
  await writeFile(path.join(directory, 'input.json'), JSON.stringify({ checkout: { ...checkout, templates }, shard, configurations }))
  const errors: string[] = []
  try {
    await runCollector(process.execPath, ['--import', 'tsx', 'scripts/performanceGate/worker.ts'], {
      cwd: process.cwd(),
      logFile: path.join(directory, 'collector.log'),
      timeoutMs,
      env: { PERFORMANCE_SAMPLE_DIR: directory },
      redact: [checkout.cwd, process.cwd()],
    })
  }
  catch (error) {
    errors.push(String(error))
  }
  try {
    const data = JSON.parse(await readFile(path.join(directory, 'values.json'), 'utf8')) as { values: AuditSample[], errors: string[] }
    return { values: selected ? data.values.filter(v => selected.includes(v.id)) : data.values, errors: [...errors, ...data.errors] }
  }
  catch {
    return { values: [], errors: [...errors, 'Missing completed collector evidence'] }
  }
}

export async function collectShardBatch(checkouts: { baseline: Checkout, optimized: Checkout }, shard: string, output: string, name: string, deadline: number, selected?: string[]) {
  const batch: AuditBatch = { samples: [], errors: [] }
  const checkpoint = () => writeFile(path.join(output, `${name}.json`), JSON.stringify(batch))
  const count = pairsForShard(shard)
  const started = Date.now()
  for (let round = 0; round < count; round++) {
    for (const side of round % 2 ? ['optimized', 'baseline'] as const : ['baseline', 'optimized'] as const) {
      if (Date.now() >= deadline) {
        batch.errors.push('Shard collection deadline exceeded')
        await checkpoint()
        return batch
      }
      console.log(`[paired-perf] ${process.env.PERFORMANCE_TARGET ?? 'local'} ${name} ${shard} ${round + 1}/${count} ${side} @ ${checkouts[side].commit} elapsed=${Math.round((Date.now() - started) / 1000)}s; remaining=${Math.round((deadline - Date.now()) / 1000)}s`)
      const collected = await collectSide(checkouts[side], shard, path.join(output, name, String(round), side), selected, Math.min(15 * 60_000, deadline - Date.now()))
      batch.samples.push({ round, side, values: collected.values })
      batch.errors.push(...collected.errors.map(error => `${name} pair ${round + 1} ${side}: ${error}`))
      await checkpoint()
      if (!collected.values.length && collected.errors.length) {
        return batch
      }
    }
  }
  return batch
}
