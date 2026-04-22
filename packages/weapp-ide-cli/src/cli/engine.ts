import type {
  PollWechatIdeEngineBuildResult,
  WechatDevtoolsHttpCommandOptions,
} from './http'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  pollWechatIdeEngineBuildResultByHttp,
  startWechatIdeEngineBuildByHttp,
} from './http'

export interface RunWechatIdeEngineBuildByHttpOptions extends WechatDevtoolsHttpCommandOptions {
  onProgress?: (result: PollWechatIdeEngineBuildResult) => void
  overallTimeoutMs?: number
  pollIntervalMs?: number
}

export interface RunWechatIdeEngineBuildOptions extends RunWechatIdeEngineBuildByHttpOptions {
  logPath?: string
}

function createEngineBuildError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function createEngineBuildLogFilename() {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ]
  return `${parts.join('-')}.json`
}

async function resolveEngineBuildLogFilePath(logPath: string) {
  const resolvedLogPath = path.resolve(logPath)

  try {
    const stat = await fs.stat(resolvedLogPath)
    if (stat.isDirectory()) {
      return path.join(resolvedLogPath, createEngineBuildLogFilename())
    }

    await fs.rm(resolvedLogPath, { force: true })
  }
  catch {
  }

  await fs.mkdir(path.dirname(resolvedLogPath), { recursive: true })
  return resolvedLogPath
}

async function writeEngineBuildLog(logPath: string | undefined, content: string) {
  if (!logPath) {
    return
  }

  const filePath = await resolveEngineBuildLogFilePath(logPath)
  await fs.writeFile(filePath, content, 'utf8')
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

/**
 * @description 以更接近官方 CLI 的方式执行 engine build，并支持将构建日志写入文件。
 */
export async function runWechatIdeEngineBuild(
  projectPath: string,
  options: RunWechatIdeEngineBuildOptions = {},
) {
  const logs: string[] = []
  let lastLoggedMessage: string | undefined

  try {
    const result = await runWechatIdeEngineBuildByHttp(projectPath, {
      ...options,
      onProgress: (progress) => {
        if (progress.msg && progress.msg !== lastLoggedMessage) {
          lastLoggedMessage = progress.msg
          logs.push(progress.msg)
        }
        options.onProgress?.(progress)
      },
    })

    await writeEngineBuildLog(
      options.logPath,
      logs.join('\n'),
    )
    return result
  }
  catch (error) {
    logs.push(error instanceof Error ? error.message : String(error))
    await writeEngineBuildLog(
      options.logPath,
      logs.join('\n'),
    )
    throw error
  }
}
