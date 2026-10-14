/* eslint-disable e18e/ban-dependencies -- 跨平台启动基准子进程，清理复用受管进程所有权。 */
import type { Buffer } from 'node:buffer'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { createDevProcessCleanup } from '../../e2e/utils/devProcessCleanup'
import { CollectorStopError } from './collectorStop'

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
  let exited = false
  // 立即监听 rejection，同时撤销已退出根进程的权限，不从旧 PID 再发现后代。
  const result = child.then((value) => {
    exited = true
    return { value }
  }, (error: unknown) => {
    exited = true
    return { error }
  })
  const appendOutput = (chunk: Buffer) => {
    const text = clean(chunk.toString())
    log.write(text)
    process.stdout.write(text)
  }
  child.all?.on('data', appendOutput)
  const release = createDevProcessCleanup({
    pid: child.pid,
    isRootHeld: () => !exited && child.nodeChildProcess != null
      && child.nodeChildProcess.exitCode === null && child.nodeChildProcess.signalCode === null,
    disconnectRoot: () => false,
    settledExit: result,
  })
  let reason = ''
  let cancelled = false
  let firstError: Error | undefined
  let cleanupFailure: { error: unknown } | undefined
  let cleanup: Promise<void> | undefined
  let resolveCleanup!: () => void
  const cleanupFinished = new Promise<void>(resolve => resolveCleanup = resolve)
  const stop = (message: string, cause?: unknown) => {
    if (reason) {
      return
    }
    reason = message
    firstError = new Error(message, { cause })
    cleanup = release(1_000).catch((error: unknown) => {
      cleanupFailure = { error }
    }).finally(resolveCleanup)
  }
  const onSignal = () => {
    cancelled = true
    stop('Collector interrupted')
  }
  process.once('SIGTERM', onSignal)
  process.once('SIGINT', onSignal)
  const deadline = setTimeout(stop, options.timeoutMs, `Collector deadline exceeded (${options.timeoutMs} ms)`)
  const heartbeat = setInterval(() => {
    const progress = `[performance-progress] ${path.basename(options.logFile)} elapsed=${Math.round((Date.now() - started) / 1000)}s\n`
    process.stdout.write(progress)
    log.write(progress)
    if (logError) {
      stop('Cannot persist collector log', logError)
    }
  }, options.heartbeatMs ?? 30_000)
  let completedValue!: Awaited<typeof child>
  try {
    // 身份检查失败时及时保留现场并报告，不等活进程退出，也不降级为未核验的 kill。
    const completed = await Promise.race([result, cleanupFinished.then(() => undefined)])
    if (completed && !reason) {
      if ('error' in completed) {
        stop(`Collector failed: exit=unavailable ${clean(String(completed.error))}`, completed.error)
      }
      else if (completed.value.exitCode !== 0) {
        const failure = completed.value instanceof Error ? completed.value : undefined
        stop(`Collector failed: exit=${completed.value.exitCode ?? 'unavailable'}${failure ? ` ${clean(failure.message)}` : ''}`, failure)
      }
    }
    await cleanup
    if (firstError) {
      if (cleanupFailure || cancelled) {
        throw new CollectorStopError(firstError, cleanupFailure, cancelled, cleanupFailure ? `${reason}; collector cleanup also failed: ${clean(String(cleanupFailure.error))}` : reason)
      }
      throw firstError
    }
    if (!completed || !('value' in completed)) {
      throw new Error('Missing completed collector evidence')
    }
    completedValue = completed.value
  }
  finally {
    clearTimeout(deadline)
    clearInterval(heartbeat)
    process.off('SIGTERM', onSignal)
    process.off('SIGINT', onSignal)
    child.all?.off('data', appendOutput)
    if (!log.destroyed) {
      await new Promise<void>((resolve) => {
        log.once('error', () => resolve())
        log.end(clean(`\n${reason}\n${cleanupFailure ? `Collector cleanup failed: ${String(cleanupFailure.error)}\n` : ''}`), resolve)
      })
    }
  }
  if (logError) {
    throw logError
  }
  return completedValue
}
