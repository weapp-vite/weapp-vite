import type { UploadAction, UploadContext, UploadProgress } from './types'
import process from 'node:process'
import { prepareUpload } from './index'
import { terminateUploadDescendants } from './processTree'
import { redactUploadSecrets } from './tools'
import { normalizeUploadResult } from './uploadResult'

// 断连与信号只终止本地执行，已经发出的远端请求仍可能成功。
process.once('disconnect', () => process.exit(1))
process.once('SIGINT', () => process.exit(1))
process.once('SIGTERM', () => process.exit(1))
process.once('exit', () => {
  try {
    terminateUploadDescendants(process.pid)
  }
  catch {
    process.stderr.write('无法确认本地 SDK 子进程已全部终止。\n')
    process.exitCode = 1
  }
})

try {
  let input = ''
  for await (const chunk of process.stdin) {
    input += String(chunk)
  }
  const { platform, context, action } = JSON.parse(input) as { platform: string, context: UploadContext, action: UploadAction }
  if (action !== 'upload' && action !== 'preview') {
    throw new Error('不支持的上传或预览操作。')
  }
  const upload = await prepareUpload(platform, context, action)
  // 确认父进程已经观察到 started 后才调用 SDK，未获许可的 worker 不会发出上传请求。
  await new Promise<void>((resolve, reject) => {
    const onMessage = (message: unknown) => {
      if (message && typeof message === 'object'
        && 'type' in message && message.type === 'run'
        && 'action' in message && message.action === action) {
        process.off('message', onMessage)
        resolve()
      }
    }
    if (!process.send) {
      reject(new Error('上传 worker 缺少父进程 IPC 通道。'))
      return
    }
    process.on('message', onMessage)
    process.send({ type: 'started', action }, (error) => {
      if (error) {
        process.off('message', onMessage)
        reject(error)
      }
    })
  })
  const onProgress = (event: UploadProgress) => {
    const safeEvent: UploadProgress = {
      type: event.type,
      ...(typeof event.message === 'string' ? { message: redactUploadSecrets(event.message, upload.secrets) } : {}),
      ...(typeof event.percent === 'number' && Number.isFinite(event.percent) ? { percent: event.percent } : {}),
    }
    process.send?.({ type: 'progress', action, event: safeEvent }, (error) => {
      if (error) {
        process.exit(1)
      }
    })
  }
  const rawResult = await upload.run(onProgress)
  const result = action === 'upload' ? normalizeUploadResult(platform, rawResult, upload.secrets) : rawResult
  // SDK 完成后不保留第三方心跳；等待 IPC 确认和输出排空再退出。
  const finish = () => process.stderr.write('', () => process.stdout.write('', () => process.exit(0)))
  if (process.send) {
    process.send({ type: 'completed', action, result }, (error) => {
      if (error) {
        process.exit(1)
      }
      finish()
    })
  }
  else {
    finish()
  }
}
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`, () => process.exit(1))
}
