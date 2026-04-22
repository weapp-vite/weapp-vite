import type {
  PollWechatIdeEngineBuildResult,
  WechatDevtoolsHttpCommandOptions,
} from './http'
import {
  pollWechatIdeEngineBuildResultByHttp,
  startWechatIdeEngineBuildByHttp,
} from './http'

export interface RunWechatIdeEngineBuildByHttpOptions extends WechatDevtoolsHttpCommandOptions {
  onProgress?: (result: PollWechatIdeEngineBuildResult) => void
  overallTimeoutMs?: number
  pollIntervalMs?: number
}

function createEngineBuildError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * @description 通过开发者工具 HTTP 服务端口执行 engine build，并轮询直到构建结束。
 */
export async function runWechatIdeEngineBuildByHttp(
  projectPath: string,
  options: RunWechatIdeEngineBuildByHttpOptions = {},
) {
  await startWechatIdeEngineBuildByHttp(projectPath, options)

  const startedAt = Date.now()

  while (true) {
    if (Date.now() - startedAt > (options.overallTimeoutMs ?? 120_000)) {
      throw createEngineBuildError('WECHAT_DEVTOOLS_ENGINE_BUILD_TIMEOUT', 'WECHAT_DEVTOOLS_ENGINE_BUILD_TIMEOUT')
    }

    const result = await pollWechatIdeEngineBuildResultByHttp(options)
    options.onProgress?.(result)

    if (result.failed) {
      throw createEngineBuildError(
        result.msg || result.body || 'WECHAT_DEVTOOLS_ENGINE_BUILD_FAILED',
        'WECHAT_DEVTOOLS_ENGINE_BUILD_FAILED',
      )
    }

    if (result.done) {
      return result
    }

    await sleep(options.pollIntervalMs ?? 1_000)
  }
}
