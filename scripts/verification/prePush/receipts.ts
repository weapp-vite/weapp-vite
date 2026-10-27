import type { TaskResult, VerificationPlan, VerificationReport } from '../types.ts'
import type { PushTarget } from './refs.ts'
import { createHash, randomUUID } from 'node:crypto'
import { glob, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

interface PushReceipt {
  version: 1
  scope: 'pre-push-quick'
  key: string
  target: PushTarget
  fingerprint: string
  taskIds: string[]
  report: VerificationReport
}

/** 回执绑定真实策略字节及环境摘要；环境原文和凭据从不写入报告。 */
export async function pushReceiptKey(root: string, identity: unknown): Promise<string> {
  const files: string[] = []
  for await (const file of glob(['scripts/verification/**/*.ts', 'scripts/verification/**/*.mjs', 'scripts/verification/**/*.mts'], { cwd: root })) {
    files.push(file.replaceAll('\\', '/'))
  }
  const policy = await Promise.all(files.sort().map(async file => [file, await readFile(path.join(root, file), 'utf8')]))
  const installed = await Promise.all(['tsx', 'execa', 'yaml', 'turbo'].map(async (name) => {
    try {
      return [name, await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8')]
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      return [name, null]
    }
  }))
  const environment = Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b))
  const environmentDigest = createHash('sha256').update(JSON.stringify(environment)).digest('hex')
  return createHash('sha256').update(JSON.stringify({ version: 1, identity, policy, installed, environmentDigest })).digest('hex')
}

function successfulSubtasks(subtasks: TaskResult['subtasks']): boolean {
  if (subtasks === undefined) {
    return true
  }
  return Array.isArray(subtasks) && subtasks.some(task => task && ['actual', 'cached'].includes(task.execution))
    && subtasks.every(task => task && (
      (task.execution === 'not-executed' && task.exitCode === undefined)
      || (task.execution === 'cached' && (task.exitCode === undefined || task.exitCode === 0))
      || (task.execution === 'actual' && task.exitCode === 0)
    ))
}

function successful(report: VerificationReport, ids: string[], fingerprint: string): boolean {
  return report?.version === 1 && report.mode === 'quick'
    && ['passed', 'partial'].includes(report.status) && report.fingerprint === fingerprint
    && Array.isArray(report.results) && report.results.length === ids.length
    && report.results.every(result => result && typeof result.id === 'string')
    && new Set(ids).size === ids.length && new Set(report.results.map(result => result.id)).size === ids.length
    && report.results.every(result => ids.includes(result.id) && result.status === 'passed' && result.exitCode === 0
      && ['actual', 'cached', 'mixed'].includes(result.execution) && successfulSubtasks(result.subtasks))
}

/** 只接受当前完整身份下、全部适用 quick 任务均成功的回执。 */
export async function readPushReceipt(file: string, key: string): Promise<boolean> {
  let receipt: PushReceipt
  try {
    receipt = JSON.parse(await readFile(file, 'utf8')) as PushReceipt
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) {
      return false
    }
    throw error
  }
  return receipt?.version === 1 && receipt.scope === 'pre-push-quick' && receipt.key === key
    && Array.isArray(receipt.taskIds) && typeof receipt.fingerprint === 'string'
    && successful(receipt.report, receipt.taskIds, receipt.fingerprint)
}

/** 计划与结果必须一一对应；局部 quick 回执不冒充 CI 或 runtime 完成证明。 */
export async function writePushReceipt(file: string, key: string, target: PushTarget, plan: VerificationPlan, report: VerificationReport): Promise<void> {
  const ids = plan.tasks.map(task => task.id)
  if (plan.mode !== 'quick' || plan.selection !== 'affected' || plan.changes.head !== target.head
    || plan.changes.base !== target.base || !successful(report, ids, plan.fingerprint)) {
    throw new Error('候选快检没有完整成功证据，拒绝保存推送回执')
  }
  const receipt: PushReceipt = { version: 1, scope: 'pre-push-quick', key, target, fingerprint: plan.fingerprint, taskIds: ids, report }
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' })
    await rename(temporary, file)
  }
  finally {
    await rm(temporary, { force: true })
  }
}
