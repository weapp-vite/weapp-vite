import { readWechatLoginState } from '@weapp-vite/miniprogram-automator/operation'
import { execute } from '../utils'

export type WechatIdeLoginQueryResult
  = { status: 'success', login: boolean }
    | { status: 'unknown', reason: 'timeout' | 'command-failed' | 'invalid-response' }

/** 读取原生 CLI 的明确登录结果；日志、空输出与相互矛盾的响应均不能证明登录状态。 */
function parseLoginOutput(stdout: string): WechatIdeLoginQueryResult {
  const login = readWechatLoginState(stdout)
  if (login !== undefined) {
    return { status: 'success', login }
  }
  return { status: 'unknown', reason: 'invalid-response' }
}

/** 显式调用指定 CLI 查询登录语义，不重试、不提示登录；原生 CLI 可能启动 IDE。 */
export async function queryWechatIdeLogin(cliPath: string, options: { timeout?: number, signal?: AbortSignal } = {}): Promise<WechatIdeLoginQueryResult> {
  const timeout = options.timeout ?? 3_000
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new TypeError('登录查询 timeout 必须是有限正数。')
  }
  try {
    const result = await execute(cliPath, ['islogin'], { pipeStdout: false, pipeStderr: false, timeout, signal: options.signal })
    return parseLoginOutput(result.stdout)
  }
  catch (error) {
    const timedOut = error && typeof error === 'object' && 'timedOut' in error && error.timedOut === true
    return { status: 'unknown', reason: timedOut ? 'timeout' : 'command-failed' }
  }
}
