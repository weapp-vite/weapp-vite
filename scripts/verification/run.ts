import type { TaskResult, VerificationPlan, VerificationReport, VerificationTask } from './types.ts'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 统一处理跨平台进程、取消与退出状态。
import { execa } from 'execa'
import { readTurboEvidence } from './evidence.ts'

export type TaskExecutor = (task: VerificationTask, signal?: AbortSignal) => Promise<{ exitCode: number } & Partial<Pick<TaskResult, 'execution' | 'subtasks'>>>

export function createTaskExecutor(root: string, jsonOutput = false): TaskExecutor {
  return async (task, signal) => {
    if (process.env.WEAPP_VITE_VERIFICATION_LOCAL_DIR) {
      const { executeLocalTask } = await import('../verificationBenchmark/localTask.mjs')
      return await executeLocalTask(root, task, signal, jsonOutput)
    }
    let output = ''
    const destination = jsonOutput ? process.stderr : process.stdout
    const subprocess = execa(task.command, task.args, {
      cwd: path.resolve(root, task.directory),
      env: task.env,
      stdin: 'inherit',
      stdout: task.evidence ? 'pipe' : destination,
      stderr: process.stderr,
      buffer: false,
      reject: false,
      cancelSignal: signal,
    })
    subprocess.stdout?.setEncoding('utf8')
    subprocess.stdout?.on('data', (chunk: string) => {
      destination.write(chunk)
      output = `${output}${chunk}`.slice(-65_536)
    })
    const result = await subprocess
    if (result.exitCode === 0 && task.id === 'dist-sync:weapp-vite') {
      process.stderr.write('dist sync: rebuilt weapp-vite before downstream validation\n')
    }
    const evidence = task.evidence ? await readTurboEvidence(root, output) : { execution: 'actual' as const }
    return { exitCode: result.exitCode ?? 1, ...evidence }
  }
}

function validateGraph(tasks: VerificationTask[]) {
  const ids = new Set(tasks.map(task => task.id))
  if (ids.size !== tasks.length) {
    throw new Error('验证任务 ID 重复')
  }
  for (const task of tasks) {
    for (const id of task.dependencies) {
      if (!ids.has(id)) {
        throw new Error(`任务 ${task.id} 缺少依赖 ${id}`)
      }
    }
  }
  const resolved = new Set<string>()
  while (resolved.size < tasks.length) {
    const ready = tasks.filter(task => !resolved.has(task.id) && task.dependencies.every(id => resolved.has(id)))
    if (!ready.length) {
      throw new Error('验证任务图包含循环依赖')
    }
    ready.forEach(task => resolved.add(task.id))
  }
}

function isExclusive(task: VerificationTask): boolean {
  return Boolean(task.exclusive || (task.resource && task.resource !== 'cpu'))
}

/** 共享一个并发预算；构建图与 runtime 独占阶段，失败阻断其依赖。 */
export async function runVerification(plan: VerificationPlan, execute: TaskExecutor, options: {
  signal?: AbortSignal
  onResult?: (result: TaskResult) => void
} = {}): Promise<VerificationReport> {
  validateGraph(plan.tasks)
  const started = performance.now()
  const startedAt = new Date().toISOString()
  const results = new Map<string, TaskResult>()
  const pending = new Map(plan.tasks.map(task => [task.id, task]))
  const running = new Map<string, Promise<void>>()
  const finish = (result: TaskResult) => {
    results.set(result.id, result)
    options.onResult?.(result)
  }
  const launch = (task: VerificationTask) => {
    pending.delete(task.id)
    const begin = performance.now()
    const work = Promise.resolve().then(async () => {
      try {
        const result = await execute(task, options.signal)
        if (task.evidence && !result.execution) {
          throw new Error('受管 Turbo 任务缺少 summary 执行证据')
        }
        finish({ id: task.id, durationMs: performance.now() - begin, status: result.exitCode === 0 ? 'passed' : 'failed', exitCode: result.exitCode, execution: result.execution ?? 'actual', subtasks: result.subtasks })
      }
      catch (error) {
        finish({ id: task.id, durationMs: performance.now() - begin, status: options.signal?.aborted ? 'cancelled' : 'failed', execution: 'unknown', error: error instanceof Error ? error.message : String(error) })
      }
      finally {
        running.delete(task.id)
      }
    })
    running.set(task.id, work)
  }
  while (pending.size || running.size) {
    for (const task of pending.values()) {
      const dependencyFailed = task.dependencies.some(id => results.has(id) && results.get(id)?.status !== 'passed')
      if (options.signal?.aborted || dependencyFailed || task.blockedReason) {
        pending.delete(task.id)
        finish({ id: task.id, durationMs: 0, status: options.signal?.aborted ? 'cancelled' : 'blocked', execution: 'not-executed', error: task.blockedReason ?? (dependencyFailed ? '前置验证未通过' : undefined) })
      }
    }
    const ready = [...pending.values()].filter(task => task.dependencies.every(id => results.get(id)?.status === 'passed'))
    const exclusiveRunning = [...running.keys()].some(id => isExclusive(plan.tasks.find(task => task.id === id)!))
    if (!exclusiveRunning) {
      const exclusive = ready.find(isExclusive)
      if (exclusive && !running.size) {
        launch(exclusive)
      }
      else if (!exclusive) {
        for (const task of ready.slice(0, Math.max(0, plan.resources.jobs - running.size))) {
          launch(task)
        }
      }
    }
    if (running.size) {
      await Promise.race(running.values())
    }
    else if (pending.size) {
      throw new Error('验证任务无法继续，依赖图状态异常')
    }
  }
  const ordered = plan.tasks.map(task => results.get(task.id)!)
  const failed = ordered.some(result => result.status === 'failed' || result.status === 'cancelled')
  const blocked = ordered.some(result => result.status === 'blocked')
  const remaining = [...plan.remaining, ...ordered.filter(result => result.execution === 'not-executed' && result.status === 'passed')
    .map(result => `${result.id} 没有实际验证任务，不能计为通过`)]
  return {
    version: 1,
    mode: plan.mode,
    fingerprint: plan.fingerprint,
    startedAt,
    durationMs: performance.now() - started,
    status: failed ? 'failed' : blocked ? 'blocked' : remaining.length || !ordered.length ? 'partial' : 'passed',
    results: ordered,
    remaining,
  }
}
