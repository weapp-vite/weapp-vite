import type { UploadContext } from './types'
import process from 'node:process'
import { prepareUpload } from './index'

// 父进程消失或主动取消时，不能继续执行远端上传。
process.once('disconnect', () => process.exit(1))
process.once('SIGINT', () => process.exit(1))
process.once('SIGTERM', () => process.exit(1))

try {
  let input = ''
  for await (const chunk of process.stdin) {
    input += String(chunk)
  }
  const { platform, context } = JSON.parse(input) as { platform: string, context: UploadContext }
  const upload = await prepareUpload(platform, context)
  await upload.run()
  // SDK 完成后不保留第三方心跳；等待 IPC 确认和输出排空再退出。
  const finish = () => process.stderr.write('', () => process.stdout.write('', () => process.exit(0)))
  if (process.send) {
    process.send({ type: 'uploaded' }, (error) => {
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
