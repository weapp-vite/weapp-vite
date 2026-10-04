import type {
  PollWechatIdeEngineBuildResult,
  WechatDevtoolsHttpCommandOptions,
} from './http'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
// eslint-disable-next-line e18e/ban-dependencies -- DevTools CLI fallback 需要跨平台进程执行与超时控制。
import { execa } from 'execa'
import { assertWechatDevtoolsHost, resolveWechatDevtoolsTarget } from '../devtoolsTarget'
import {
  openWechatIdeProjectByHttp,
  pollWechatIdeEngineBuildResultByHttp,
  resetWechatIdeFileUtilsByHttp,
  startWechatIdeEngineBuildByHttp,
} from './http'

export interface RunWechatIdeEngineBuildByHttpOptions extends WechatDevtoolsHttpCommandOptions {
  onProgress?: (result: PollWechatIdeEngineBuildResult) => void
  overallTimeoutMs?: number
  pollIntervalMs?: number
}

export interface RunWechatIdeEngineBuildOptions extends RunWechatIdeEngineBuildByHttpOptions {
  fallbackToCli?: boolean
  /** 避免 CLI 诊断污染协议标准输出。 */
  quiet?: boolean
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
const ENGINE_BUILD_ENDPOINT_MISSING_MESSAGE = '当前微信开发者工具未提供 engine build 接口，已跳过自动 engine build 刷新。'
const ENGINE_BUILD_CLI_OPENED_PATTERN = /打开项目成功|project\s+opened|open\s+project\s+success|(?:^|\n)\s*✔\s*open(?:\n|$)/i
const COMPACT_WHITESPACE_PATTERN = /\s+/g

function sleep(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
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

function createEngineBuildEndpointMissingError() {
  return createEngineBuildError(
    ENGINE_BUILD_ENDPOINT_MISSING_MESSAGE,
    'WECHAT_DEVTOOLS_ENGINE_BUILD_ENDPOINT_MISSING',
  )
}

export function isWechatIdeEngineBuildEndpointMissingError(error: unknown) {
  return error instanceof Error
    && 'code' in error
    && error.code === 'WECHAT_DEVTOOLS_ENGINE_BUILD_ENDPOINT_MISSING'
}

function compactOutput(value: string | undefined) {
  return typeof value === 'string'
    ? value.replace(COMPACT_WHITESPACE_PATTERN, ' ').trim()
    : ''
}

async function runWechatIdeEngineBuildByCli(projectPath: string, options: RunWechatIdeEngineBuildOptions = {}) {
  options.signal?.throwIfAborted()
  const target = await resolveWechatDevtoolsTarget(options).catch((error: unknown) => {
    options.signal?.throwIfAborted()
    throw error
  })
  options.signal?.throwIfAborted()
  await assertWechatDevtoolsHost(target, { signal: options.signal })
  options.signal?.throwIfAborted()

  const result = await execa(target.cliPath, ['engine', 'build', path.resolve(projectPath)], {
    ...(options.signal ? { cancelSignal: options.signal } : {}),
    killDescendants: true,
    reject: false,
    timeout: options.overallTimeoutMs ?? 120_000,
  }).catch((error: unknown) => {
    options.signal?.throwIfAborted()
    throw error
  })
  options.signal?.throwIfAborted()
  const stdout = typeof result.stdout === 'string' ? result.stdout : ''
  const stderr = typeof result.stderr === 'string' ? result.stderr : ''
  const output = [stdout, stderr].filter(Boolean).join('\n')
  await writeEngineBuildLog(options.logPath, output)
  options.signal?.throwIfAborted()

  if ((result.exitCode ?? 1) === 0) {
    if (stdout && !options.quiet) {
      process.stdout.write(stdout)
    }
    if (stderr && !options.quiet) {
      process.stderr.write(stderr)
    }
    return
  }

  if (ENGINE_BUILD_CLI_OPENED_PATTERN.test(output)) {
    return
  }

  if (isEngineBuildEndpointMissingError(output)) {
    throw createEngineBuildEndpointMissingError()
  }

  if (stdout && !options.quiet) {
    process.stdout.write(stdout)
  }
  if (stderr && !options.quiet) {
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
async function runSelectedWechatIdeEngineBuildByHttp(
  projectPath: string,
  options: RunWechatIdeEngineBuildByHttpOptions = {},
) {
  options.signal?.throwIfAborted()
  await startWechatIdeEngineBuildByHttp(projectPath, options)

  const startedAt = Date.now()

  while (true) {
    options.signal?.throwIfAborted()
    if (Date.now() - startedAt > (options.overallTimeoutMs ?? 120_000)) {
      throw createEngineBuildError('WECHAT_DEVTOOLS_ENGINE_BUILD_TIMEOUT', 'WECHAT_DEVTOOLS_ENGINE_BUILD_TIMEOUT')
    }

    const result = await pollWechatIdeEngineBuildResultByHttp(options)
    options.signal?.throwIfAborted()
    options.onProgress?.(result)
    options.signal?.throwIfAborted()

    if (result.failed) {
      throw createEngineBuildError(
        result.msg || result.body || 'WECHAT_DEVTOOLS_ENGINE_BUILD_FAILED',
        'WECHAT_DEVTOOLS_ENGINE_BUILD_FAILED',
      )
    }

    if (result.done) {
      return result
    }

    await sleep(options.pollIntervalMs ?? 1_000, options.signal)
  }
}

/**
 * @description 以更接近官方 CLI 的方式执行 engine build，并支持将构建日志写入文件。
 */
async function runSelectedWechatIdeEngineBuild(
  projectPath: string,
  options: RunWechatIdeEngineBuildOptions = {},
) {
  const logs: string[] = []
  let lastLoggedMessage: string | undefined

  try {
    const result = await runSelectedWechatIdeEngineBuildByHttp(projectPath, {
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
    options.signal?.throwIfAborted()
    return result
  }
  catch (error) {
    options.signal?.throwIfAborted()
    if (isEngineBuildEndpointMissingError(error)) {
      if (options.fallbackToCli === false) {
        throw createEngineBuildEndpointMissingError()
      }
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

/** 固定安装上下文后完整持有 HTTP 构建与轮询期间的租约。 */
export async function runWechatIdeEngineBuildByHttp(projectPath: string, options: RunWechatIdeEngineBuildByHttpOptions = {}) {
  options.signal?.throwIfAborted()
  return await withMachineE2ELease(async () => {
    const target = await resolveWechatDevtoolsTarget(options)
    options.signal?.throwIfAborted()
    return await runSelectedWechatIdeEngineBuildByHttp(projectPath, { ...options, target })
  })
}

/** HTTP、轮询与 CLI 回退沿用同一次解析的安装。 */
export async function runWechatIdeEngineBuild(projectPath: string, options: RunWechatIdeEngineBuildOptions = {}) {
  options.signal?.throwIfAborted()
  return await withMachineE2ELease(async () => {
    const target = await resolveWechatDevtoolsTarget(options)
    options.signal?.throwIfAborted()
    return await runSelectedWechatIdeEngineBuild(projectPath, { ...options, target })
  })
}

async function prepareSelectedAcceptanceProject(projectPath: string, signal: AbortSignal, options: WechatDevtoolsHttpCommandOptions) {
  await openWechatIdeProjectByHttp(projectPath, { ...options, signal, timeoutMs: 10_000 })
  await sleep(1000, signal)
  await resetWechatIdeFileUtilsByHttp(projectPath, { ...options, signal, timeoutMs: 10_000 })
  const result = await runWechatIdeEngineBuild(projectPath, { ...options, signal, overallTimeoutMs: 60_000, timeoutMs: 10_000, quiet: true })
  // CLI 回退确认打开时，模拟器可能尚未完成重载。
  if (!result) {
    await sleep(1500, signal)
  }
  return result
}

/** 在验收交互前等待 IDE 消费产物，并沿用该会话选择的安装。 */
export async function prepareAcceptanceProject(projectPath: string, signal: AbortSignal, options: WechatDevtoolsHttpCommandOptions & { runtimeProvider?: 'headless' | 'devtools' } = {}) {
  signal.throwIfAborted()
  if (options.runtimeProvider === 'headless') {
    return
  }
  return await withMachineE2ELease(async () => {
    const target = await resolveWechatDevtoolsTarget(options)
    signal.throwIfAborted()
    return await prepareSelectedAcceptanceProject(projectPath, signal, { ...options, target })
  })
}
