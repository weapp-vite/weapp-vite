import path from 'node:path'
import { detectWechatDevtoolsServicePort } from './wechatDevtoolsSettings'

const DEFAULT_WECHAT_DEVTOOLS_HTTP_PORT = 9420

export interface WechatDevtoolsHttpCommandOptions {
  port?: number
  timeoutMs?: number
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

async function requestWechatDevtoolsHttp(
  pathname: string,
  query: Record<string, string>,
  options: WechatDevtoolsHttpCommandOptions = {},
) {
  const port = await resolveWechatDevtoolsHttpPort(options.port)
  const url = new URL(`http://127.0.0.1:${port}${pathname}`)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }

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
