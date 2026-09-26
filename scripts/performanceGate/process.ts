/* eslint-disable e18e/ban-dependencies -- 跨平台启动和终止基准子进程树。 */
import type { Buffer } from 'node:buffer'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { execa } from 'execa'

export function descendantPids(root: number, listing: string): number[] {
  const rows = listing.split(/\r?\n/).map(line => line.trim().split(/\s+/).map(Number))
  const seen = new Set<number>()
  const visit = (pid: number): number[] => {
    if (seen.has(pid)) {
      return []
    }
    seen.add(pid)
    return [...rows.filter(row => row[1] === pid).flatMap(row => visit(row[0]!)), pid]
  }
  return visit(root)
}

export async function terminateTree(pid: number, platform = process.platform, ownGroup = false) {
  if (platform === 'win32') {
    const result = await execa('taskkill', ['/PID', String(pid), '/T', '/F'], { reject: false, timeout: 10_000 })
    if (result.exitCode !== 0) {
      throw new Error('Windows process-tree cleanup failed')
    }
    return
  }
  // 独立进程组在父进程提前退出后仍覆盖已被重新托管的后代。
  const pids = ownGroup ? [-pid] : descendantPids(pid, (await execa('ps', ['-Ao', 'pid=,ppid='], { timeout: 5_000 })).stdout)
  const signal = (kind: NodeJS.Signals) => pids.forEach((id) => {
    try {
      process.kill(id, kind)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        throw error
      }
    }
  })
  signal('SIGTERM')
  await delay(1_000)
  signal('SIGKILL')
}

/** 子进程有界运行；诊断进度独立于采样计时，失败也保存输出。 */
export async function runCollector(command: string, args: string[], options: {
  cwd: string
  logFile: string
  timeoutMs: number
  env?: NodeJS.ProcessEnv
  redact?: string[]
  heartbeatMs?: number
}) {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('Invalid collector deadline')
  }
  const started = Date.now()
  const clean = (value: string) => (options.redact ?? [options.cwd]).reduce((text, root) => text.replaceAll(root, '<checkout>'), value)
  await mkdir(path.dirname(options.logFile), { recursive: true })
  const log = createWriteStream(options.logFile)
  let logError: Error | undefined
  log.on('error', (error) => {
    logError = error
  })
  const child = execa(command, args, { cwd: options.cwd, env: options.env, reject: false, all: true, detached: process.platform !== 'win32' })
  // 立即监听 rejection，避免清理期间未处理的进程错误。
  const result = child.then(value => value, error => error as { exitCode?: number, all?: string, message: string })
  child.all?.on('data', (chunk: Buffer) => {
    const text = clean(chunk.toString())
    log.write(text)
    process.stdout.write(text)
  })
  let reason = ''
  let cleanup: Promise<void> | undefined
  const stop = (message: string) => {
    if (reason) {
      return
    }
    reason = message
    cleanup = child.pid
      ? terminateTree(child.pid, process.platform, true).catch(() => {
          child.kill('SIGKILL')
        })
      : Promise.resolve()
  }
  const onSignal = () => stop('Collector interrupted')
  process.once('SIGTERM', onSignal)
  process.once('SIGINT', onSignal)
  const deadline = setTimeout(stop, options.timeoutMs, `Collector deadline exceeded (${options.timeoutMs} ms)`)
  const heartbeat = setInterval(() => {
    const progress = `[performance-progress] ${path.basename(options.logFile)} elapsed=${Math.round((Date.now() - started) / 1000)}s\n`
    process.stdout.write(progress)
    log.write(progress)
    if (logError) {
      stop('Cannot persist collector log')
    }
  }, options.heartbeatMs ?? 30_000)
  let completed: Awaited<typeof result>
  try {
    completed = await result
    if (completed.exitCode !== 0 && !reason) {
      stop(`Collector failed: exit=${completed.exitCode ?? 'unavailable'} ${'message' in completed ? clean(completed.message ?? '') : ''}`)
    }
    await cleanup
    if (reason || completed.exitCode !== 0) {
      throw new Error(reason || `Collector failed: exit=${completed.exitCode ?? 'unavailable'} ${'message' in completed ? completed.message : ''}`)
    }
  }
  finally {
    clearTimeout(deadline)
    clearInterval(heartbeat)
    process.off('SIGTERM', onSignal)
    process.off('SIGINT', onSignal)
    if (!log.destroyed) {
      await new Promise<void>((resolve) => {
        log.once('error', () => resolve())
        log.end(clean(`\n${reason}\n`), resolve)
      })
    }
  }
  if (logError) {
    throw logError
  }
  return completed
}
