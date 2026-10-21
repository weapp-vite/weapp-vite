import type { VerificationPlan, VerificationReport } from './types.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** 报告只保留可复现的仓库相对命令，错误中的本机路径统一脱敏。 */
export function redactReport(value: string, root: string): string {
  let result = value
  for (const location of [...new Set([root, os.homedir()])].sort((a, b) => b.length - a.length)) {
    for (const spelling of [location, location.replaceAll('\\', '/')]) {
      result = result.replaceAll(spelling, location === root ? '<repo>' : '<home>')
    }
  }
  return result
}

export function formatPlan(plan: VerificationPlan): string {
  return [
    `验证模式: ${plan.mode}；变更 ${plan.changes.files.length} 文件；影响 ${plan.affected.length} 包`,
    `范围策略: ${plan.selection}；建议 ${plan.suggested.length} 包，实际 ${plan.selected.length} 包${plan.selection === 'shadow' ? '（仅观测，实际保持保守范围）' : ''}`,
    `资源预算: CPU ${plan.resources.cpuBudget}/${plan.resources.cpus}，${plan.resources.jobs} 并行任务，构建并发 ${plan.resources.buildConcurrency}（默认半数 CPU；--jobs 显式覆盖并受内存限制）`,
    ...plan.tasks.map(task => `${task.id}: ${task.command} ${task.args.join(' ')}\n  ${task.reason}${task.blockedReason ? `\n  blocked: ${task.blockedReason}` : ''}`),
    ...plan.warnings.map(warning => `注意: ${warning}`),
    ...plan.remaining.map(item => `待验收: ${item}`),
  ].join('\n')
}

export function formatReport(report: VerificationReport): string {
  return [
    `验证结果: ${report.status} (${(report.durationMs / 1000).toFixed(2)}s)`,
    ...[...report.results].sort((a, b) => b.durationMs - a.durationMs).flatMap(result => [
      `${result.status} ${result.id} [${result.execution}]: ${(result.durationMs / 1000).toFixed(2)}s${result.error ? ` (${result.error})` : ''}`,
      ...(result.subtasks ?? []).map(task => `  ${task.id}: ${task.execution}`),
    ]),
    ...report.remaining.map(item => `待验收: ${item}`),
  ].join('\n')
}

export async function saveReport(root: string, directory: string, plan: VerificationPlan, report?: VerificationReport): Promise<void> {
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'plan.json'), `${redactReport(JSON.stringify(plan, null, 2), root)}\n`)
  if (report) {
    await writeFile(path.join(directory, 'report.json'), `${redactReport(JSON.stringify(report, null, 2), root)}\n`)
    await writeFile(path.join(directory, 'report.md'), `${redactReport(formatReport(report), root)}\n`)
  }
}
