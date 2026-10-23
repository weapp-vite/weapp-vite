import process from 'node:process'
import { createNativeHostControl } from '../../packages/weapp-vite/scripts/consumerHmr/hostControl/index.mjs'
import { startDevProcess } from './dev-process'
import { withDevProcessShutdownTrace } from './devProcessShutdownTrace'

/** WV 明确使用 IPC；原生 Vite/Vite+ 通过实际叶宿主的 close 入口收尾。 */
export async function startRuntimeDevProcess(host: string, args: readonly string[], options: NonNullable<Parameters<typeof startDevProcess>[2]> & { cwd: string }) {
  if (host === 'wv') {
    return startDevProcess(process.execPath, args, { ...options, env: withDevProcessShutdownTrace(options.env), ipc: true })
  }
  if (host !== 'vite' && host !== 'vite-plus') {
    throw new Error(`Unsupported runtime development host: ${host}`)
  }
  const configIndex = args.indexOf('--config')
  const configFile = args[configIndex + 1]
  if (configIndex < 0 || !configFile) {
    throw new Error('Native runtime development requires an explicit configuration file')
  }
  const control = await createNativeHostControl(options.cwd, configFile)
  const controlledArgs = [...args]
  controlledArgs[configIndex + 1] = control.configFile
  try {
    return startDevProcess(process.execPath, controlledArgs, {
      ...options,
      ipc: false,
      gracefulShutdown: () => control.requestClose(),
      disposeShutdown: () => control.dispose(),
    })
  }
  catch (error) {
    try {
      await control.dispose()
    }
    catch (disposalError) {
      throw new AggregateError([error, disposalError], 'Native runtime startup and control disposal failed', { cause: error })
    }
    throw error
  }
}
