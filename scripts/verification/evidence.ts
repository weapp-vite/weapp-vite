import type { TaskResult } from './types.ts'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'

interface TurboSummary {
  id: string
  tasks: Array<{
    taskId: string
    command: string
    cache: { status: string }
    execution?: { startTime?: number, exitCode?: number }
  }>
}

/** 只读取当前子进程亲自输出的 summary，不猜测共享目录中最新的一份。 */
export async function readTurboEvidence(root: string, output: string): Promise<Pick<TaskResult, 'execution' | 'subtasks'>> {
  const candidates = stripVTControlCharacters(output).split('\n').filter(line => line.startsWith('Summary:'))
  if (candidates.length !== 1) {
    throw new Error('Turbo 未提供唯一的实际执行 summary，不能确认实际执行或缓存命中')
  }
  const summaryPath = path.resolve(candidates[0]!.slice('Summary:'.length).trim())
  if (path.dirname(summaryPath) !== path.resolve(root, '.turbo/runs')) {
    throw new Error('Turbo summary 不属于当前仓库运行目录')
  }
  const parsed: unknown = JSON.parse(await readFile(summaryPath, 'utf8'))
  const summary = parsed as TurboSummary
  if (!summary || path.basename(summaryPath) !== `${summary.id}.json` || !Array.isArray(summary.tasks)) {
    throw new Error('Turbo summary 结构或运行身份无效')
  }
  const subtasks = summary.tasks.map((task): NonNullable<TaskResult['subtasks']>[number] => {
    if (typeof task.taskId !== 'string' || typeof task.command !== 'string' || typeof task.cache?.status !== 'string') {
      throw new TypeError('Turbo 子任务缺少实际执行证据')
    }
    const execution = task.command === '<NONEXISTENT>'
      ? 'not-executed'
      : task.cache.status === 'HIT'
        ? 'cached'
        : typeof task.execution?.startTime === 'number' ? 'actual' : 'not-executed'
    return { id: task.taskId, execution, exitCode: task.execution?.exitCode }
  })
  const states = new Set(subtasks.map(task => task.execution))
  return { execution: states.size > 1 ? 'mixed' : subtasks[0]?.execution ?? 'not-executed', subtasks }
}
