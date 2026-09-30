import type { ChildProcess } from 'node:child_process'
import type { UploadAction, UploadContext, UploadExecutionOptions, UploadProgress, UploadResult } from './types'
import { fork } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import logger from '../../logger'
import { UploadExecutionError } from './executionError'
import { terminateUploadDescendants, terminateUploadProcess } from './processTree'
import { validatePreviewResult } from './result'
import { redactUploadSecrets } from './tools'

function readProgress(value: unknown, secrets: readonly string[]): UploadProgress | undefined {
  if (!value || typeof value !== 'object' || !('type' in value)
    || !['progress', 'log', 'task-created', 'version-created'].includes(String(value.type))) {
    return
  }
  const event: UploadProgress = { type: value.type as UploadProgress['type'] }
  if ('message' in value && typeof value.message === 'string') {
    event.message = redactUploadSecrets(value.message, secrets)
  }
  if ('percent' in value && typeof value.percent === 'number' && Number.isFinite(value.percent)
    && value.percent >= 0 && value.percent <= 100) {
    event.percent = value.percent
  }
  return event
}

/** 强制终止可能截断日志尾部；同时隐藏已知凭据的不完整前缀，保留普通诊断。 */
function redactDiagnostic(message: string, secrets: readonly string[]): string {
  const output = message.trimEnd()
  let end = output.length
  for (const value of secrets) {
    const secret = value.trimEnd()
    if (!secret) {
      continue
    }
    let start = output.indexOf(secret[0]!, Math.max(0, output.length - secret.length))
    while (start !== -1) {
      let offset = 0
      while (start + offset < output.length && output[start + offset] === secret[offset]) {
        offset++
      }
      if (start + offset === output.length) {
        end = Math.min(end, start)
        break
      }
      start = output.indexOf(secret[0]!, start + 1)
    }
  }
  // 先确定原始尾部的最长凭据匹配，避免较短凭据的替换破坏较长凭据的前缀。
  return redactUploadSecrets(end < output.length ? `${output.slice(0, end)}[REDACTED]` : output, secrets)
}

/** 隔离官方 SDK；完成确认与正常退出必须同时成立，取消仅作用于本地进程。 */
export async function executeUpload(platform: string, context: UploadContext, secrets: string[], action: UploadAction = 'upload', options: UploadExecutionOptions = {}): Promise<UploadResult> {
  const label = `${platform} ${action === 'preview' ? '预览' : '上传'}`
  if (options.signal?.aborted) {
    throw new UploadExecutionError(`${label}已中断（SDK 尚未开始）。`, 'interrupted', 'not-started')
  }
  const { result, output } = await new Promise<{ result: UploadResult, output: string }>((resolve, reject) => {
    const spawnedAt = Date.now()
    let child: ChildProcess
    try {
      child = fork(fileURLToPath(new URL('./upload-worker.mjs', import.meta.url)), [], {
        cwd: context.cwd,
        env: context.env,
        execArgv: [],
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        detached: process.platform !== 'win32',
        windowsHide: true,
      })
    }
    catch (error) {
      reject(new UploadExecutionError(redactUploadSecrets(`${label}无法启动：${String(error)}`, secrets), 'failed', 'not-started'))
      return
    }
    let completed = false
    let started = false
    let settled = false
    let result: UploadResult = {}
    const captured = { stdout: '', stderr: '' }
    let capturedSize = 0
    let failure: { reason: UploadExecutionError['reason'], detail: string } | undefined
    let timer: NodeJS.Timeout | undefined
    let closeTimer: NodeJS.Timeout | undefined
    const terminate = (descendants = true) => {
      if (!child.pid) {
        return
      }
      const exited = child.exitCode !== null || child.signalCode !== null
      try {
        if (descendants && !exited && process.platform !== 'win32') {
          terminateUploadDescendants(child.pid)
        }
      }
      catch (error) {
        failure ??= { reason: 'failed', detail: '无法清理本地子进程' }
        failure.detail += `；${String(error)}`
      }
      try {
        terminateUploadProcess(child.pid, {
          processGroup: true,
          exited,
          lifetime: { start: spawnedAt, end: Date.now() },
        })
      }
      catch (error) {
        failure ??= { reason: 'failed', detail: '无法终止本地 worker' }
        failure.detail += `；${String(error)}`
        if (!exited) {
          child.kill('SIGKILL')
        }
      }
    }
    const stop = (reason: UploadExecutionError['reason'], detail: string) => {
      if (settled || failure) {
        return
      }
      failure = { reason, detail }
      clearTimeout(timer)
      terminate()
    }
    const cancel = () => stop('interrupted', '本地执行已中断')
    const onParentExit = () => terminate()
    const collect = (stream: keyof typeof captured, chunk: string) => {
      if (failure) {
        return
      }
      const limit = 4 * 1024 * 1024
      const remaining = limit - capturedSize
      if (chunk.length > remaining) {
        // 不保留被截断的原始日志，避免密钥跨越上限时留下无法完整匹配的片段。
        captured.stdout = ''
        captured.stderr = ''
        stop('failed', '日志超限，已省略日志以保护凭据')
        return
      }
      captured[stream] += chunk
      capturedSize += chunk.length
    }
    const onStdout = (chunk: string) => collect('stdout', chunk)
    const onStderr = (chunk: string) => collect('stderr', chunk)
    const onError = (error: Error) => stop('failed', error.message)
    const onDisconnect = () => {
      if (!completed) {
        stop('failed', 'IPC 连接中断，未收到完成确认')
      }
    }
    const onMessage = (message: unknown) => {
      if (settled || failure || !message || typeof message !== 'object'
        || !('action' in message) || message.action !== action || !('type' in message)) {
        return
      }
      if (message.type === 'started' && !started) {
        started = true
        // 只有父进程确认边界后才允许调用 SDK，避免超时与 started IPC 交错而误报未开始。
        child.send({ type: 'run', action }, (error) => {
          if (error) {
            onError(error)
          }
        })
      }
      else if (message.type === 'progress' && 'event' in message) {
        const event = readProgress(message.event, secrets)
        if (event) {
          try {
            options.onProgress?.(event)
          }
          catch (error) {
            stop('failed', `进度处理失败：${String(error)}`)
          }
        }
      }
      else if (message.type === 'completed' && started) {
        completed = true
        result = 'result' in message && message.result && typeof message.result === 'object'
          ? message.result as UploadResult
          : {}
      }
    }
    const onExit = () => {
      clearTimeout(timer)
      // Windows 从 ParentProcessId 恢复子树；POSIX 清理仍然存在的进程组。
      terminate(false)
      closeTimer = setTimeout(() => {
        failure ??= { reason: 'failed', detail: 'worker 已退出' }
        failure.detail += '；日志管道未关闭，本地子进程清理未确认'
        captured.stdout = ''
        captured.stderr = ''
        child.stdin?.destroy()
        child.stdout?.destroy()
        child.stderr?.destroy()
      }, 1000)
    }
    const cleanup = () => {
      clearTimeout(timer)
      clearTimeout(closeTimer)
      options.signal?.removeEventListener('abort', cancel)
      process.off('SIGINT', cancel)
      process.off('SIGTERM', cancel)
      process.off('exit', onParentExit)
      child.off('message', onMessage)
      child.off('error', onError)
      child.off('disconnect', onDisconnect)
      child.off('exit', onExit)
      child.stdout?.off('data', onStdout)
      child.stderr?.off('data', onStderr)
      child.stdin?.off('error', onError)
    }
    child.once('close', (code, signal) => {
      settled = true
      cleanup()
      // 两路日志独立脱敏，避免 stderr 插入 stdout 的凭据片段后破坏匹配。
      const output = [redactDiagnostic(captured.stdout, secrets), redactDiagnostic(captured.stderr, secrets)].filter(Boolean).join('\n').trim()
      if (failure || code !== 0 || !completed) {
        const detail = failure?.detail ?? `${signal ?? code ?? 'unknown'}，${completed ? '进程异常结束' : '未收到完成确认'}`
        const uncertainty = started ? '远端结果未知，请核实平台状态；未自动重试。' : 'SDK 尚未开始。'
        reject(new UploadExecutionError(
          redactUploadSecrets(`${label}失败（${detail}）。${uncertainty}${output ? `\n${output}` : ''}`, secrets),
          failure?.reason ?? 'failed',
          started ? 'unknown' : 'not-started',
        ))
        return
      }
      resolve({ result, output })
    })
    child.on('error', onError)
    child.on('disconnect', onDisconnect)
    child.on('message', onMessage)
    child.once('exit', onExit)
    child.stdout?.setEncoding('utf8').on('data', onStdout)
    child.stderr?.setEncoding('utf8').on('data', onStderr)
    child.stdin?.on('error', onError)
    process.once('exit', onParentExit)
    if (options.signal) {
      options.signal.addEventListener('abort', cancel, { once: true })
    }
    else {
      process.once('SIGINT', cancel)
      process.once('SIGTERM', cancel)
    }
    if (options.timeoutMs !== undefined) {
      timer = setTimeout(stop, options.timeoutMs, 'timeout', `本地执行超时（${options.timeoutMs}ms）`)
    }
    if (options.signal?.aborted) {
      cancel()
    }
    else {
      try {
        child.stdin?.end(JSON.stringify({ platform, context, action }))
      }
      catch (error) {
        stop('failed', String(error))
      }
    }
  })
  if (output) {
    logger.info(output)
  }
  return action === 'preview' ? validatePreviewResult(result, context) : result
}
