import type { UploadContext } from './types'
import { fork } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import logger from '../../logger'
import { redactUploadSecrets } from './tools'

/** 隔离官方 SDK 的日志和进程级副作用，主进程通过 stdin 传入上下文。 */
export async function executeUpload(platform: string, context: UploadContext, secrets: string[]): Promise<void> {
  const output = await new Promise<string>((resolve, reject) => {
    const child = fork(fileURLToPath(new URL('./upload-worker.mjs', import.meta.url)), [], {
      cwd: context.cwd,
      env: context.env,
      execArgv: [],
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })
    let completed = false
    let exceeded = false
    let captured = ''
    let cancelled = false
    const cancel = () => {
      cancelled = true
      child.kill()
    }
    process.once('SIGINT', cancel)
    process.once('SIGTERM', cancel)
    const collect = (chunk: string) => {
      if (exceeded) {
        return
      }
      captured += chunk
      if (captured.length > 4 * 1024 * 1024) {
        exceeded = true
        child.kill()
      }
    }
    child.stdout?.setEncoding('utf8').on('data', collect)
    child.stderr?.setEncoding('utf8').on('data', collect)
    child.on('message', (message) => {
      completed = message !== null && typeof message === 'object'
        && 'type' in message && message.type === 'uploaded'
    })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      process.off('SIGINT', cancel)
      process.off('SIGTERM', cancel)
      const safeOutput = redactUploadSecrets(captured, secrets).trim()
      if (code !== 0 || !completed || exceeded || cancelled) {
        reject(new Error(`${platform} 上传失败（${exceeded ? '日志超限' : signal ?? code ?? 'unknown'}，${completed ? '进程异常结束' : '未收到完成确认'}）${safeOutput ? `\n${safeOutput}` : ''}`))
        return
      }
      resolve(safeOutput)
    })
    child.stdin?.on('error', () => { /* 子进程提前退出的错误由 close 事件处理。 */ })
    child.stdin?.end(JSON.stringify({ platform, context }))
  })
  if (output) {
    logger.info(output)
  }
}
