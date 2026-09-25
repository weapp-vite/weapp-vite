import type { AuditSample, Checkout } from './collect'
import type { OutputEvidence } from './outputEvidence'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 四组使用同一个已准备 checkout 的 CLI 串行采样。
import { execa } from 'execa'

export const autoImportCounts = [1, 20, 50, 69]
const modes = ['manual', 'automatic'] as const
interface RawBuild { cliBuildMs?: number | null, repeatCliBuildMs?: number | null, durationMs: number, repeatDurationMs: number, rssPeakBytes?: number, repeatRssPeakBytes?: number, output: OutputEvidence, repeatOutput: OutputEvidence }
interface RawHmr { startupMs: number, cycles: Array<{ editMs: number, restoreMs: number }>, updateMemory?: { rss: number, heapUsed: number } }

export function autoImportMetrics() {
  return autoImportCounts.flatMap(count => modes.flatMap(mode => [
    ...['first', 'repeat'].map(phase => `auto-build:${count}:${mode}:${phase}`),
    ...['first', 'repeat'].flatMap(phase => ['edit', 'restore'].map(action => `auto-hmr:${count}:${mode}:${phase}:${action}`)),
  ]))
}

/** 交叉比较同配置提交回退；手动/自动开销保留为另一维度。 */
export async function collectAutoImport(checkout: Checkout, driver: string, output: string, kind: 'build' | 'hmr'): Promise<AuditSample[]> {
  await mkdir(output, { recursive: true })
  const result = await execa(process.execPath, ['--import', 'tsx', `packages/weapp-vite/scripts/benchmark-auto-import-${kind}.ts`], {
    cwd: driver,
    reject: false,
    env: {
      AUTO_IMPORT_BENCH_TARGET_ROOT: checkout.cwd,
      AUTO_IMPORT_BENCH_PAIRED: '1',
      BENCH_ITERATIONS: '1',
      BENCH_SCENARIOS: autoImportCounts.join(','),
      BENCH_REPORT_DIR: output,
      // 正常配置保留支持文件，不能继承诊断开关。
      BENCH_DISABLE_CURRENT_SUPPORT_OUTPUTS: '0',
    },
  })
  await writeFile(path.join(output, 'runner.log'), `${result.stdout}\n${result.stderr}`.replaceAll(checkout.cwd, '<checkout>').replaceAll(driver, '<driver>'))
  if (result.exitCode !== 0) {
    throw new Error(`${checkout.id} auto-import ${kind} failed (${result.exitCode})`)
  }
  const data = JSON.parse(await readFile(path.join(output, 'report.json'), 'utf8')) as { results: Array<{ usedCount: number, raw: Record<typeof modes[number], Array<RawBuild & RawHmr>> }> }
  if (data.results.map(row => row.usedCount).join(',') !== autoImportCounts.join(',')) {
    throw new Error('Missing auto-import component-count scenarios')
  }
  return data.results.flatMap(row => modes.flatMap((mode): AuditSample[] => {
    const values = row.raw[mode]
    if (values.length !== 1) {
      throw new Error('Missing auto-import raw sample')
    }
    const value = values[0]!
    const template = `auto-import-${row.usedCount}`
    if (kind === 'build') {
      return ['first', 'repeat'].map(phase => ({ id: `auto-build:${row.usedCount}:${mode}:${phase}`, template, phase, ms: phase === 'first' ? value.durationMs : value.repeatDurationMs, cliMs: (phase === 'first' ? value.cliBuildMs : value.repeatCliBuildMs) ?? undefined, rssBytes: phase === 'first' ? value.rssPeakBytes : value.repeatRssPeakBytes, output: phase === 'first' ? value.output : value.repeatOutput }))
    }
    if (value.cycles.length !== 2) {
      throw new Error('Missing auto-import continuous update and restore')
    }
    return value.cycles.flatMap((cycle, index) => ['edit', 'restore'].map((action) => {
      const phase = index === 0 ? 'first' : 'repeat'
      return { id: `auto-hmr:${row.usedCount}:${mode}:${phase}:${action}`, template, phase: `${phase}:${action}`, ms: action === 'edit' ? cycle.editMs : cycle.restoreMs, rssBytes: value.updateMemory?.rss, heapBytes: value.updateMemory?.heapUsed }
    }))
  }))
}
