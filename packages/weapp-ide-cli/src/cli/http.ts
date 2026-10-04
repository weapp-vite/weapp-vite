import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import path from 'node:path'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { assertWechatDevtoolsPort, resolveWechatDevtoolsTarget } from '../devtoolsTarget'
import { getRuntimeWechatDevtoolsServicePort } from './wechatDevtoolsRuntimePort'
import { detectWechatDevtoolsServicePort } from './wechatDevtoolsSettings'

const ENGINE_BUILD_NOT_START = 'NOT_START'
const ENGINE_BUILD_OPEN_PROJECT = 'OPEN_PROJECT'
const ENGINE_BUILD_BUILDING = 'BUILDING'
const ENGINE_BUILD_END = 'END'
const ENGINE_BUILD_ERROR = 'ERROR'

export interface WechatDevtoolsHttpCommandOptions {
  cliPath?: string
  target?: ResolvedWechatDevtoolsTarget
  port?: number
  signal?: AbortSignal
  timeoutMs?: number
}

export interface WechatDevtoolsEngineBuildResult {
  msg?: string
  status?: string
}

export interface StartWechatIdeEngineBuildResult {
  body: string
}

export interface PollWechatIdeEngineBuildResult extends WechatDevtoolsEngineBuildResult {
  body: string
  done: boolean
  failed: boolean
}

function createWechatDevtoolsHttpError(message: string, code: string) {
  const error = new Error(message) as Error & { code: string }
  error.code = code
  return error
}

async function resolveWechatDevtoolsHttpPort(target: ResolvedWechatDevtoolsTarget, port?: number) {
  if (port !== undefined) {
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw createWechatDevtoolsHttpError('The explicit DevTools HTTP port must be an integer from 1 to 65535.', 'WECHAT_DEVTOOLS_INVALID_PORT')
    }
    return port
  }

  const runtimePort = getRuntimeWechatDevtoolsServicePort(target)
  if (runtimePort) {
    return runtimePort
  }

  const detected = await detectWechatDevtoolsServicePort({ target })
  if (detected.servicePortEnabled === false) {
    throw createWechatDevtoolsHttpError('WECHAT_DEVTOOLS_SERVICE_PORT_DISABLED', 'WECHAT_DEVTOOLS_SERVICE_PORT_DISABLED')
  }

  if (!detected.servicePort) {
    throw createWechatDevtoolsHttpError('The selected DevTools installation has no known HTTP service port.', 'WECHAT_DEVTOOLS_SERVICE_PORT_UNKNOWN')
  }
  return detected.servicePort
}

function createWechatDevtoolsHttpUrl(port: number, pathname: string, query: Record<string, string>) {
  const url = new URL(`http://127.0.0.1:${port}${pathname}`)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return url
}

function parseWechatDevtoolsEngineBuildResult(body: string) {
  try {
    const parsed = JSON.parse(body) as WechatDevtoolsEngineBuildResult
    return parsed
  }
  catch {
    return {}
  }
}

async function requestSelectedWechatDevtoolsHttp(
  pathname: string,
  query: Record<string, string>,
  options: WechatDevtoolsHttpCommandOptions = {},
) {
  options.signal?.throwIfAborted()
  const target = await resolveWechatDevtoolsTarget(options)
  options.signal?.throwIfAborted()
  const port = await resolveWechatDevtoolsHttpPort(target, options.port).catch((error: unknown) => {
    options.signal?.throwIfAborted()
    throw error
  })
  options.signal?.throwIfAborted()
  await assertWechatDevtoolsPort(target, port, { signal: options.signal, timeout: options.timeoutMs })
  options.signal?.throwIfAborted()
  const url = createWechatDevtoolsHttpUrl(port, pathname, query)

  const controller = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const timeout = setTimeout(() => {
    controller.abort(createWechatDevtoolsHttpError('WECHAT_DEVTOOLS_HTTP_TIMEOUT', 'WECHAT_DEVTOOLS_HTTP_TIMEOUT'))
  }, options.timeoutMs ?? 10_000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal,
    })
    const body = await response.text()
    signal.throwIfAborted()
    if (!response.ok) {
      throw createWechatDevtoolsHttpError(body || `HTTP ${response.status}`, 'WECHAT_DEVTOOLS_HTTP_REQUEST_FAILED')
    }
    return body
  }
  catch (error) {
    signal.throwIfAborted()
    throw error
  }
  finally {
    clearTimeout(timeout)
  }
}

/** 请求期间持有机器租约，避免 E2E 与另一入口同时更改共享宿主。 */
export async function requestWechatDevtoolsHttp(pathname: string, query: Record<string, string>, options: WechatDevtoolsHttpCommandOptions = {}) {
  options.signal?.throwIfAborted()
  return await withMachineE2ELease(() => requestSelectedWechatDevtoolsHttp(pathname, query, options))
}

/**
 * @description 请求微信开发者工具打开项目并返回原始响应；目标 runtime 状态仍需通过会话或界面确认。
 */
export async function openWechatIdeProjectByHttp(
  projectPath: string,
  options: WechatDevtoolsHttpCommandOptions = {},
) {
  const body = await requestWechatDevtoolsHttp('/v2/open', {
    project: path.resolve(projectPath),
  }, options)
  const response = body.trim()
  if (!response || /^\{\s*\}$/.test(response)) {
    throw createWechatDevtoolsHttpError('DevTools HTTP returned no project-open result; the target project opening is unconfirmed.', 'WECHAT_DEVTOOLS_HTTP_OPEN_UNCONFIRMED')
  }
  return body
}

/**
 * @description 通过微信开发者工具 HTTP 服务端口重置当前项目的 fileutils 状态。
 */
export async function resetWechatIdeFileUtilsByHttp(
  projectPath: string,
  options: WechatDevtoolsHttpCommandOptions = {},
) {
  return await requestWechatDevtoolsHttp('/v2/resetfileutils', {
    project: path.resolve(projectPath),
  }, options)
}

/**
 * @description 通过微信开发者工具 HTTP 服务端口触发 engine build。
 */
export async function startWechatIdeEngineBuildByHttp(
  projectPath: string,
  options: WechatDevtoolsHttpCommandOptions = {},
): Promise<StartWechatIdeEngineBuildResult> {
  const body = await requestWechatDevtoolsHttp('/engine/build', {
    projectpath: path.resolve(projectPath),
  }, options)
  return { body }
}

/**
 * @description 轮询微信开发者工具 engine build 状态。
 */
export async function pollWechatIdeEngineBuildResultByHttp(
  options: WechatDevtoolsHttpCommandOptions = {},
): Promise<PollWechatIdeEngineBuildResult> {
  const body = await requestWechatDevtoolsHttp('/engine/buildResult/', {}, options)
  const parsed = parseWechatDevtoolsEngineBuildResult(body)
  const status = parsed.status

  return {
    body,
    done: status === ENGINE_BUILD_END,
    failed: status === ENGINE_BUILD_ERROR,
    msg: parsed.msg,
    status,
  }
}

export const WECHAT_DEVTOOLS_ENGINE_BUILD_STATUSES = {
  BUILDING: ENGINE_BUILD_BUILDING,
  END: ENGINE_BUILD_END,
  ERROR: ENGINE_BUILD_ERROR,
  NOT_START: ENGINE_BUILD_NOT_START,
  OPEN_PROJECT: ENGINE_BUILD_OPEN_PROJECT,
} as const
