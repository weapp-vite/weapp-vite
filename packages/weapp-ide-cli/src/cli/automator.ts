import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Launcher, OperationLifecycle } from '@weapp-vite/miniprogram-automator'
import { readCustomConfig } from '../config/custom'
import { resolveAutomatorProjectPath } from './automatorProject'
import { resolveCliPath } from './resolver'
import { bootstrapWechatDevtoolsSettings } from './wechatDevtoolsSettings'

export interface AutomatorOptions {
  projectPath: string
  timeout?: number
  signal?: AbortSignal
  cliPath?: string
  port?: number
  sessionId?: string
  trustProject?: boolean
  preferOpenedSession?: boolean
  preserveProjectRoot?: boolean
  persistAsDefaultSession?: boolean
}

interface PersistedAutomatorSession {
  port?: number
  projectPath: string
  sessionId?: string
  updatedAt: string
  wsEndpoint: string
}

const ERROR_STACK_PREFIX_RE = /^at /
const ERROR_PREFIX_RE = /^\[error\]\s*/i
const ERROR_LABEL_PREFIX_RE = /^error\s*:\s*/i
const ERROR_LINE_SPLIT_RE = /\r?\n/
const LOGIN_REQUIRED_CN_RE = /需要重新登录/
const LOGIN_REQUIRED_EN_RE = /need\s+re-?login|re-?login/i
const LOGIN_REQUIRED_CODE_RE = /code\s*[:=]\s*(\d+)/i
const DEVTOOLS_HTTP_PORT_ERROR = 'Failed to launch wechat web devTools, please make sure http port is open'
const DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED_RE = /Extension context invalidated/i
const AUTOMATOR_LAUNCH_TIMEOUT_RE = /Wait timed out after \d+ ms/i
const AUTOMATOR_WS_CONNECT_RE = /Failed connecting to ws:\/\/127\.0\.0\.1:\d+/i
const AUTOMATOR_PORT_IN_USE_RE = /Port \d+ is in use, please specify another port/i
const DEVTOOLS_PROTOCOL_TIMEOUT_RE = /DevTools did not respond to protocol method (\S+) within \d+ms/i
const DEVTOOLS_INFRA_ERROR_PATTERNS = [
  /#initialize-error:\s*wait IDE port timeout/i,
  /wait IDE port timeout/i,
  /listen EPERM/i,
  /operation not permitted 0\.0\.0\.0/i,
  /EACCES/i,
  /ECONNREFUSED/i,
  /connect ECONNREFUSED/i,
]
const DEFAULT_WECHAT_DEVTOOLS_WS_PORT = 9420
const PROJECT_AUTOMATOR_PORT_BASE = 9620
const PROJECT_AUTOMATOR_PORT_RANGE = 2000
const AUTOMATOR_SESSION_DIR = path.join(os.tmpdir(), 'weapp-vite-automator-sessions')
const DEVTOOLS_LOGIN_REQUIRED_PATTERNS = [
  /code\s*[:=]\s*10/i,
  /需要重新登录/,
  /need\s+re-?login/i,
  /re-?login/i,
]

/**
 * @description 从错误对象中提取可读文本。
 */
function extractErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return ''
  }

  const candidate = error as {
    message?: unknown
    shortMessage?: unknown
    stderr?: unknown
    stdout?: unknown
  }

  return [
    candidate.message,
    candidate.shortMessage,
    candidate.stderr,
    candidate.stdout,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
}

function normalizeAutomatorSessionId(sessionId: string | undefined, port: number | undefined) {
  if (sessionId?.trim()) {
    return sessionId.trim()
  }
  return port ? `port-${port}` : 'default'
}

/**
 * @description 为项目路径派生稳定的 DevTools automator 端口，避免多个 dev:open 项目抢占默认端口。
 */
export function resolveProjectAutomatorPort(projectPath: string) {
  const digest = createHash('sha1').update(path.resolve(projectPath)).digest()
  const offset = digest.readUInt32BE(0) % PROJECT_AUTOMATOR_PORT_RANGE
  return PROJECT_AUTOMATOR_PORT_BASE + offset
}

function resolveAutomatorSessionFilePath(projectPath: string, sessionId?: string, port?: number) {
  const normalizedProjectPath = path.resolve(projectPath)
  const normalizedSessionId = normalizeAutomatorSessionId(sessionId, port)
  const sessionKey = normalizedSessionId === 'default'
    ? normalizedProjectPath
    : `${normalizedProjectPath}#${normalizedSessionId}`
  const encodedProjectPath = Buffer.from(sessionKey).toString('base64url')
  return path.join(AUTOMATOR_SESSION_DIR, `${encodedProjectPath}.json`)
}

async function persistAutomatorSession(options: {
  port?: number
  projectPath: string
  sessionId?: string
  wsEndpoint: string
  signal?: AbortSignal
}) {
  options.signal?.throwIfAborted()
  const filePath = resolveAutomatorSessionFilePath(options.projectPath, options.sessionId, options.port)
  const payload: PersistedAutomatorSession = {
    ...(options.port ? { port: options.port } : {}),
    projectPath: path.resolve(options.projectPath),
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    updatedAt: new Date().toISOString(),
    wsEndpoint: options.wsEndpoint,
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  options.signal?.throwIfAborted()
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf8', signal: options.signal })
}

async function readPersistedAutomatorSession(projectPath: string, sessionId?: string, port?: number) {
  const filePath = resolveAutomatorSessionFilePath(projectPath, sessionId, port)

  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const payload = JSON.parse(raw) as Partial<PersistedAutomatorSession>
    if (payload.projectPath !== path.resolve(projectPath) || typeof payload.wsEndpoint !== 'string' || !payload.wsEndpoint.trim()) {
      return null
    }
    if (sessionId && payload.sessionId !== sessionId) {
      return null
    }
    if (port && payload.port !== port) {
      return null
    }
    return payload as PersistedAutomatorSession
  }
  catch {
    return null
  }
}

/**
 * @description 提取登录失效时最适合展示给用户的一行信息。
 */
function extractLoginRequiredMessage(text: string): string {
  if (!text) {
    return ''
  }

  if (LOGIN_REQUIRED_CN_RE.test(text)) {
    return '需要重新登录'
  }

  const englishMatch = text.match(LOGIN_REQUIRED_EN_RE)
  if (englishMatch?.[0]) {
    return englishMatch[0].toLowerCase()
  }

  const firstLine = text
    .split(ERROR_LINE_SPLIT_RE)
    .map(line => line.trim())
    .find(line => Boolean(line) && !ERROR_STACK_PREFIX_RE.test(line))

  if (!firstLine) {
    return ''
  }

  return firstLine
    .replace(ERROR_PREFIX_RE, '')
    .replace(ERROR_LABEL_PREFIX_RE, '')
    .slice(0, 120)
}

/**
 * @description 判断错误是否属于开发者工具服务端口不可用。
 */
export function isDevtoolsHttpPortError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(DEVTOOLS_HTTP_PORT_ERROR)
    || DEVTOOLS_INFRA_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

/**
 * @description 判断错误是否属于开发者工具 automator 扩展上下文尚未就绪。
 */
export function isDevtoolsExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED_RE.test(message)
}

/**
 * @description 判断错误是否属于可重试的 automator 启动抖动。
 */
export function isRetryableAutomatorLaunchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return DEVTOOLS_EXTENSION_CONTEXT_INVALIDATED_RE.test(message)
    || AUTOMATOR_LAUNCH_TIMEOUT_RE.test(message)
    || AUTOMATOR_WS_CONNECT_RE.test(message)
}

/**
 * @description 判断错误是否属于开发者工具 websocket 连接失败。
 */
export function isAutomatorWsConnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return AUTOMATOR_WS_CONNECT_RE.test(message)
}

/**
 * @description 判断错误是否属于目标项目 automator 端口仍被旧会话占用。
 */
export function isAutomatorPortInUseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return AUTOMATOR_PORT_IN_USE_RE.test(message)
}

/**
 * @description 判断错误是否属于开发者工具协议调用超时。
 */
export function isAutomatorProtocolTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return DEVTOOLS_PROTOCOL_TIMEOUT_RE.test(message)
}

/**
 * @description 提取协议超时的方法名。
 */
export function getAutomatorProtocolTimeoutMethod(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error)
  return message.match(DEVTOOLS_PROTOCOL_TIMEOUT_RE)?.[1]
}

/**
 * @description 判断错误是否属于开发者工具登录失效。
 */
export function isAutomatorLoginError(error: unknown): boolean {
  const text = extractErrorText(error)
  if (!text) {
    return false
  }

  return DEVTOOLS_LOGIN_REQUIRED_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * @description 格式化开发者工具登录失效错误，便于终端展示。
 */
export function formatAutomatorLoginError(error: unknown): string {
  const text = extractErrorText(error)
  const code = text.match(LOGIN_REQUIRED_CODE_RE)?.[1]
  const message = extractLoginRequiredMessage(text)

  const lines = ['微信开发者工具返回登录错误：']
  if (code) {
    lines.push(`- code: ${code}`)
  }
  if (message) {
    lines.push(`- message: ${message}`)
  }
  if (!code && !message) {
    lines.push('- message: 需要重新登录')
  }

  return lines.join('\n')
}

/**
 * @description 基于当前配置解析 CLI 路径，并通过现代化 automator 入口启动会话。
 */
export async function launchAutomator(options: AutomatorOptions) {
  const { cliPath, port, projectPath, sessionId, timeout = 30_000 } = options
  const lifecycle = new OperationLifecycle(timeout, 'IDE launch', options.signal)
  return await lifecycle.run(async (scope) => {
    const resolvedCliPath = cliPath ?? (await scope.step(() => resolveCliPath(), { stage: 'resolve-cli' })).cliPath ?? undefined
    const config = await scope.step(() => readCustomConfig(), { stage: 'configuration' })
    const resolvedTrustProject = options.trustProject ?? config.autoTrustProject ?? false
    const launcher = new Launcher()
    let lastError: unknown = null
    let bootstrapResult: Awaited<ReturnType<typeof bootstrapWechatDevtoolsSettings>> | undefined
    const resolvedProject = options.preserveProjectRoot
      ? {
          projectPath: path.resolve(projectPath),
          sourceProjectPath: path.resolve(projectPath),
        }
      : await scope.step(() => resolveAutomatorProjectPath(projectPath), { stage: 'project' })

    if (config.autoBootstrapDevtools !== false) {
      bootstrapResult = await scope.step(() => bootstrapWechatDevtoolsSettings({
        projectPath: resolvedProject.projectPath,
        trustProject: resolvedTrustProject,
      }), { stage: 'settings' })
    }

    if (bootstrapResult?.servicePortEnabled === false) {
      throw new Error('Detected WeChat DevTools service port is disabled in current settings. Please enable it manually; existing user settings were not modified.')
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      scope.attempt()
      try {
        const miniProgram = await scope.step(() => launcher.launch({
          cliPath: resolvedCliPath,
          ...(port ? { port } : {}),
          projectPath: resolvedProject.projectPath,
          timeout: scope.remainingMs(),
          signal: scope.signal,
          trustProject: resolvedTrustProject,
        }), { stage: 'launch', disposeLate: program => program.disconnect() })
        scope.own(() => miniProgram.disconnect(), 'automator-session')
        const sessionMetadata = Reflect.get(miniProgram as object, '__WEAPP_VITE_SESSION_METADATA') as { port?: number, wsEndpoint?: string } | undefined
        if (typeof sessionMetadata?.wsEndpoint === 'string' && sessionMetadata.wsEndpoint) {
          const wsEndpoint = sessionMetadata.wsEndpoint
          await scope.step(() => persistAutomatorSession({
            signal: scope.signal,
            ...(port ? { port: sessionMetadata.port ?? port } : {}),
            projectPath,
            sessionId,
            wsEndpoint,
          }), { stage: 'session-persist' })
          if (options.persistAsDefaultSession && (port || sessionId)) {
            await scope.step(() => persistAutomatorSession({
              signal: scope.signal,
              projectPath,
              wsEndpoint,
            }), { stage: 'session-persist' })
          }
        }
        return miniProgram
      }
      catch (error) {
        lastError = error
        scope.recordFailure(error)
        scope.throwIfAborted()
        if (
          !isRetryableAutomatorLaunchError(error)
          || attempt === 1
        ) {
          throw error
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  })
}

/**
 * @description 只读连接当前项目已打开的自动化会话；失败不证明缓存过期，也不删除其他操作持有的会话记录。
 */
export async function connectOpenedAutomator(options: AutomatorOptions) {
  const { port, projectPath, sessionId } = options
  const lifecycle = new OperationLifecycle(options.timeout ?? 30_000, 'IDE connect', options.signal)
  return await lifecycle.run(async (scope) => {
    scope.attempt()
    const launcher = new Launcher()
    const persistedSession = await scope.step(() => readPersistedAutomatorSession(projectPath, sessionId, port), { stage: 'session-lookup' })
    const wsEndpoint = persistedSession?.wsEndpoint ?? (port ? `ws://127.0.0.1:${port}` : `ws://127.0.0.1:${DEFAULT_WECHAT_DEVTOOLS_WS_PORT}`)
    return await scope.step(() => launcher.connect({ timeout: scope.remainingMs(), signal: scope.signal, wsEndpoint }), {
      stage: 'connect',
      disposeLate: (program) => {
        if (program && typeof program === 'object' && 'disconnect' in program && typeof program.disconnect === 'function') {
          program.disconnect()
        }
      },
    })
  })
}
