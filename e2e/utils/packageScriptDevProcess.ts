import { PassThrough } from 'node:stream'
import { finished } from 'node:stream/promises'
import { consumerProcessEnvironment } from '../../packages/weapp-vite/scripts/consumerHmr/shutdown.mjs'
import { startDevProcess } from './dev-process'

type PackageScriptDevOptions = Omit<Extract<NonNullable<Parameters<typeof startDevProcess>[2]>, { encoding?: 'utf8' | 'utf16le' }>, 'gracefulShutdown' | 'disposeShutdown' | 'input' | 'ipc' | 'stdin' | 'stdio'>

/** 包管理器不转发 Node IPC；自有 stdin 的 EOF 让实际 WV 子进程进入正常会话收尾。 */
export function startPackageScriptDevProcess(command: string, args: readonly string[], options: PackageScriptDevOptions = {}) {
  const input = new PassThrough()
  try {
    return startDevProcess(command, args, {
      ...options,
      env: consumerProcessEnvironment('dev', options.env),
      ipc: false,
      stdin: 'pipe',
      input,
      gracefulShutdown: async () => {
        const ended = finished(input, { cleanup: true, readable: false })
        input.end()
        await ended
      },
      disposeShutdown: async () => {
        input.destroy()
      },
    })
  }
  catch (error) {
    input.destroy()
    throw error
  }
}
