import type {
  PollWechatIdeEngineBuildResult,
  WechatDevtoolsHttpCommandOptions,
} from './http'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- DevTools CLI fallback 需要跨平台进程执行与超时控制。
import { execa } from 'execa'
import {
  pollWechatIdeEngineBuildResultByHttp,
  startWechatIdeEngineBuildByHttp,
} from './http'
import { resolveCliPath } from './resolver'

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

const ENGINE_BUILD_ENDPOINT_MISSING_PATTERNS = [
  /Cannot GET \/engine\/build\b/i,
  /Cannot GET \/engine\/buildResult\//i,
]
const ENGINE_BUILD_CLI_OPENED_PATTERN = /打开项目成功|project\s+opened|open\s+project\s+success/i
const COMPACT_WHITESPACE_PATTERN = /\s+/g

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

function isEngineBuildEndpointMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return ENGINE_BUILD_ENDPOINT_MISSING_PATTERNS.some(pattern => pattern.test(message))
}

function compactOutput(value: string | undefined) {
  return typeof value === 'string'
    ? value.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim()
    : ''
}

async function runWechatIdeEngineBuildByCli(projectPath: string, options: RunWechatIdeEngineBuildOptions = {}) {
  const { cliPath } = await resolveCliPath()
  if (!cliPath) {
    throw createEngineBuildError('WECHAT_DEVTOOLS_CLI_NOT_FOUND', 'WECHAT_DEVTOOLS_CLI_NOT_FOUND')
  }

  const result = await execa(cliPath, ['engine', 'build', path.resolve(projectPath)], {
    reject: false,
    timeout: options.overallTimeoutMs ?? 120_000,
  })
  const stdout = typeof result.stdout === 'string' ? result.stdout : ''
  const stderr = typeof result.stderr === 'string' ? result.stderr : ''
  const output = [stdout, stderr].filter(Boolean).join('\n')
  await writeEngineBuildLog(options.logPath, output)

  if ((result.exitCode ?? 1) === 0) {
    if (stdout) {
      process.stdout.write(stdout)
    }
    if (stderr) {
      process.stderr.write(stderr)
    }
    return
  }

  if (ENGINE_BUILD_CLI_OPENED_PATTERN.test(output)) {
    return
  }

  if (stdout) {
    process.stdout.write(stdout)
  }
  if (stderr) {
    process.stderr.write(stderr)
  }

  throw createEngineBuildError(
    compactOutput(stderr) || compactOutput(stdout) || `WECHAT_DEVTOOLS_ENGINE_BUILD_CLI_FAILED:${result.exitCode ?? 1}`,
    'WECHAT_DEVTOOLS_ENGINE_BUILD_CLI_FAILED',
  )
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
    if (isEngineBuildEndpointMissingError(error)) {
      return await runWechatIdeEngineBuildByCli(projectPath, options)
    }
    logs.push(error instanceof Error ? error.message : String(error))
    await writeEngineBuildLog(
      options.logPath,
      logs.join('\n'),
    )
    throw error
  }
}
