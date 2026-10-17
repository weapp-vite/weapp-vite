import type { AutomatorSessionOptions, MiniProgramLike } from '../automator-session'
import { connectConsoleMiniProgram } from '../automator-session'

/** 刷新已有项目的日志开关，并保留日志启用与连接释放的独立错误。 */
export async function refreshOpenedMiniProgramConsoleLog(
  options: AutomatorSessionOptions,
  enableLog: (miniProgram: MiniProgramLike) => Promise<void>,
) {
  const miniProgram = await connectConsoleMiniProgram({ ...options, openedOnly: true })
  let failure: unknown
  let failed = false
  try {
    await enableLog(miniProgram)
  }
  catch (error) {
    failed = true
    failure = error
  }
  try {
    await miniProgram.disconnect()
  }
  catch (cleanupError) {
    if (failed) {
      throw new AggregateError([failure, cleanupError], 'Console log refresh and connection cleanup failed', { cause: failure })
    }
    throw cleanupError
  }
  if (failed) {
    throw failure
  }
}
