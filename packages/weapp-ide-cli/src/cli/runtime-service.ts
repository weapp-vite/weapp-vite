import type { ParsedAutomatorArgs } from './automator-argv'
import path from 'node:path'
import process from 'node:process'
import logger, { colors } from '../logger'
import { parseAutomatorArgs, readOptionValue } from './automator-argv'
import { parseScreenshotArgs } from './screenshot'

interface RuntimeServicePayload {
  [key: string]: unknown
  preferOpenedSession?: boolean
  projectPath: string
  timeout?: number
}

interface RuntimeServiceResponse {
  ok?: boolean
  result?: unknown
  error?: {
    message?: string
  }
}

const DEFAULT_RUNTIME_SERVICE_URL = 'http://127.0.0.1:3088/api/weapp/devtools'
const SERVICE_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
])

function isRuntimeServiceDisabled(argv: readonly string[]) {
  return argv.includes('--no-runtime-service')
    || process.env.WEAPP_VITE_RUNTIME_REST_URL === 'false'
    || process.env.WEAPP_IDE_CLI_RUNTIME_REST_URL === 'false'
}

function resolveRuntimeServiceUrl(argv: readonly string[]) {
  const explicit = readOptionValue(argv, '--runtime-url')
  const envValue = process.env.WEAPP_VITE_RUNTIME_REST_URL || process.env.WEAPP_IDE_CLI_RUNTIME_REST_URL
  const raw = explicit || envValue || DEFAULT_RUNTIME_SERVICE_URL
  return raw.replace(/\/+$/, '')
}

function resolveProjectPath(projectPath: string) {
  return path.resolve(projectPath)
}

function resolveOutputPath(outputPath: string | undefined) {
  return outputPath ? path.resolve(outputPath) : undefined
}

function createConnectionPayload(args: ParsedAutomatorArgs): RuntimeServicePayload {
  return {
    projectPath: resolveProjectPath(args.projectPath),
    ...(args.timeout ? { timeout: args.timeout } : {}),
  }
}

function isServiceUnavailable(error: unknown) {
  const maybeError = error as { cause?: { code?: string }, code?: string } | undefined
  const code = maybeError?.code ?? maybeError?.cause?.code
  return typeof code === 'string' && SERVICE_UNAVAILABLE_CODES.has(code)
}

async function requestRuntimeService(
  baseUrl: string,
  endpoint: string,
  payload?: RuntimeServicePayload,
  timeout = 1_000,
) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    body: payload ? JSON.stringify(payload) : undefined,
    headers: payload ? { 'content-type': 'application/json' } : undefined,
    method: payload ? 'POST' : 'GET',
    signal: AbortSignal.timeout(timeout),
  })

  if (response.status === 404) {
    return undefined
  }

  const data = await response.json().catch(() => undefined) as RuntimeServiceResponse | undefined
  if (!response.ok) {
    throw new Error(data?.error?.message || `runtime service request failed: ${response.status}`)
  }
  if (!data?.ok) {
    throw new Error(data?.error?.message || 'runtime service request failed')
  }

  return data.result
}

async function tryRequestRuntimeService(
  baseUrl: string,
  endpoint: string,
  payload?: RuntimeServicePayload,
  timeout?: number,
) {
  try {
    return await requestRuntimeService(baseUrl, endpoint, payload, timeout)
  }
  catch (error) {
    if (isServiceUnavailable(error) || (error instanceof Error && error.name === 'TimeoutError')) {
      return undefined
    }
    throw error
  }
}

function printJsonResult(result: unknown) {
  console.log(JSON.stringify(result, null, 2))
}

function formatRuntimeServiceUrl(baseUrl: string) {
  return colors.cyan(baseUrl)
}

async function runRouteCommand(command: string, args: ParsedAutomatorArgs, baseUrl: string) {
  const routeMap: Record<string, 'navigateTo' | 'redirectTo' | 'reLaunch' | 'switchTab' | 'navigateBack'> = {
    'back': 'navigateBack',
    'navigate': 'navigateTo',
    'redirect': 'redirectTo',
    'relaunch': 'reLaunch',
    'switch-tab': 'switchTab',
  }
  const transition = routeMap[command]
  if (!transition) {
    return false
  }

  const pagePath = args.positionals[0]
  if (transition !== 'navigateBack' && !pagePath) {
    return false
  }

  const result = await tryRequestRuntimeService(baseUrl, '/route', {
    ...createConnectionPayload(args),
    ...(pagePath ? { path: pagePath } : {}),
    transition,
  }, (args.timeout ?? 30_000) + 5_000)
  if (result === undefined) {
    return false
  }

  if (args.json) {
    printJsonResult(result)
  }
  else {
    logger.success(`已通过 runtime service 执行 ${command}：${formatRuntimeServiceUrl(baseUrl)}`)
  }
  return true
}

async function runInfoCommand(command: string, args: ParsedAutomatorArgs, baseUrl: string) {
  const endpointMap: Record<string, string> = {
    'current-page': '/active-page',
    'page-stack': '/page-stack',
  }
  const endpoint = endpointMap[command]
  if (!endpoint) {
    return false
  }

  const result = await tryRequestRuntimeService(baseUrl, endpoint, createConnectionPayload(args), (args.timeout ?? 30_000) + 5_000)
  if (result === undefined) {
    return false
  }

  printJsonResult(result)
  return true
}

async function runScreenshotCommand(argv: string[], baseUrl: string) {
  const options = parseScreenshotArgs(argv)
  if (options.fullPage) {
    return false
  }

  if (options.page) {
    const routeResult = await tryRequestRuntimeService(baseUrl, '/route', {
      projectPath: resolveProjectPath(options.projectPath),
      ...(options.timeout ? { timeout: options.timeout } : {}),
      path: options.page,
      transition: 'reLaunch',
    }, (options.timeout ?? 30_000) + 5_000)
    if (routeResult === undefined) {
      return false
    }
  }

  const result = await tryRequestRuntimeService(baseUrl, '/capture', {
    projectPath: resolveProjectPath(options.projectPath),
    ...(options.timeout ? { timeout: options.timeout } : {}),
    ...(options.outputPath ? { outputPath: resolveOutputPath(options.outputPath) } : {}),
  }, (options.timeout ?? 30_000) + 5_000) as { base64?: string, bytes?: number, path?: string } | undefined
  if (result === undefined) {
    return false
  }

  if (argv.includes('--json')) {
    printJsonResult(options.outputPath ? { path: options.outputPath } : result)
  }
  else if (options.outputPath) {
    logger.success(`截图已通过 runtime service 保存到 ${colors.cyan(options.outputPath)}`)
  }
  else if (result.base64) {
    process.stdout.write(`${result.base64}\n`)
  }

  return true
}

/**
 * @description 优先复用本地 runtime service，避免 CLI 单独建立 automator 连接。
 */
export async function tryRunRuntimeServiceCommand(command: string, argv: string[]) {
  if (isRuntimeServiceDisabled(argv)) {
    return false
  }

  const baseUrl = resolveRuntimeServiceUrl(argv)
  if (command === 'screenshot') {
    return await runScreenshotCommand(argv, baseUrl)
  }

  const args = parseAutomatorArgs(argv)
  return await runRouteCommand(command, args, baseUrl)
    || await runInfoCommand(command, args, baseUrl)
}
