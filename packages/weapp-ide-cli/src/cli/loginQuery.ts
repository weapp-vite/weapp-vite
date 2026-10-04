import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { OperationLifecycle, readWechatLoginState } from '@weapp-vite/miniprogram-automator/operation'
import { assertWechatDevtoolsHost, resolveWechatDevtoolsTarget } from '../devtoolsTarget'
import { execute } from '../utils'

export type WechatIdeLoginQueryResult
  = { status: 'success', login: boolean }
    | { status: 'unknown', reason: 'timeout' | 'command-failed' | 'invalid-response' | 'installation-mismatch' | 'runtime-busy' }

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
  const operation = new OperationLifecycle(timeout, 'IDE login query', options.signal)
  try {
    return await operation.run(scope => withMachineE2ELease(async () => {
      const target = await scope.step(() => resolveWechatDevtoolsTarget({ cliPath }), { stage: 'installation' })
      await scope.step(() => assertWechatDevtoolsHost(target, { signal: scope.signal, timeout: scope.remainingMs() }), { stage: 'host-identity', waitForExit: true })
      const result = await scope.step(() => execute(target.cliPath, ['islogin'], {
        pipeStdout: false,
        pipeStderr: false,
        timeout: scope.remainingMs(),
        signal: scope.signal,
      }), { stage: 'login-query', waitForExit: true })
      return parseLoginOutput(result.stdout)
    }))
  }
  catch (error) {
    options.signal?.throwIfAborted()
    if (error instanceof Error && error.message.startsWith('Runtime busy:')) {
      return { status: 'unknown', reason: 'runtime-busy' }
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH') {
      return { status: 'unknown', reason: 'installation-mismatch' }
    }
    const timedOut = operation.timedOut || (error && typeof error === 'object' && 'timedOut' in error && error.timedOut === true)
    return { status: 'unknown', reason: timedOut ? 'timeout' : 'command-failed' }
  }
}
