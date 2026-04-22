import path from 'node:path'
import { detectWechatDevtoolsServicePort } from './wechatDevtoolsSettings'

const DEFAULT_WECHAT_DEVTOOLS_HTTP_PORT = 9420
const ENGINE_BUILD_NOT_START = 'NOT_START'
const ENGINE_BUILD_OPEN_PROJECT = 'OPEN_PROJECT'
const ENGINE_BUILD_BUILDING = 'BUILDING'
const ENGINE_BUILD_END = 'END'
const ENGINE_BUILD_ERROR = 'ERROR'

export interface WechatDevtoolsHttpCommandOptions {
  port?: number
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

async function resolveWechatDevtoolsHttpPort(port?: number) {
  if (typeof port === 'number' && Number.isInteger(port) && port > 0) {
    return port
  }

  const detected = await detectWechatDevtoolsServicePort()
  if (detected.servicePortEnabled === false) {
    throw createWechatDevtoolsHttpError('WECHAT_DEVTOOLS_SERVICE_PORT_DISABLED', 'WECHAT_DEVTOOLS_SERVICE_PORT_DISABLED')
  }

  return detected.servicePort ?? DEFAULT_WECHAT_DEVTOOLS_HTTP_PORT
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

export async function requestWechatDevtoolsHttp(
  pathname: string,
  query: Record<string, string>,
  options: WechatDevtoolsHttpCommandOptions = {},
) {
  const port = await resolveWechatDevtoolsHttpPort(options.port)
  const url = createWechatDevtoolsHttpUrl(port, pathname, query)

  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, options.timeoutMs ?? 10_000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    })
    const body = await response.text()
    if (!response.ok) {
      throw createWechatDevtoolsHttpError(body || `HTTP ${response.status}`, 'WECHAT_DEVTOOLS_HTTP_REQUEST_FAILED')
    }
    return body
  }
  catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw createWechatDevtoolsHttpError('WECHAT_DEVTOOLS_HTTP_TIMEOUT', 'WECHAT_DEVTOOLS_HTTP_TIMEOUT')
    }
    throw error
  }
  finally {
    clearTimeout(timeout)
  }
}

/**
 * @description 通过微信开发者工具 HTTP 服务端口重新打开项目；若项目已打开，开发者工具会刷新当前项目。
 */
export async function openWechatIdeProjectByHttp(
  projectPath: string,
  options: WechatDevtoolsHttpCommandOptions = {},
) {
  return await requestWechatDevtoolsHttp('/open', {
    projectpath: path.resolve(projectPath),
  }, options)
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
