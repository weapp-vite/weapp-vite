import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RuntimeConnectionInput, RuntimeSessionManager } from './shared'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import {
  buildUrl,
  callRequiredMethod,
  compactObject,
  toSerializableValue,
} from './shared'

export const DEFAULT_RUNTIME_REST_ENDPOINT = '/api/weapp/devtools'

const connectionSchema = z.object({
  projectPath: z.string().trim().min(1),
  timeout: z.number().int().positive().optional(),
  preferOpenedSession: z.boolean().optional(),
})

const routeBodySchema = connectionSchema.extend({
  path: z.string().trim().min(1).optional(),
  query: z.record(z.string(), z.string()).optional(),
  transition: z.enum(['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navigateBack']).optional(),
  waitMs: z.number().int().nonnegative().optional(),
})

const activePageBodySchema = connectionSchema.extend({
  withData: z.boolean().optional(),
})

const captureBodySchema = connectionSchema.extend({
  outputPath: z.string().trim().min(1).optional(),
})

const hostApiBodySchema = connectionSchema.extend({
  method: z.string().trim().min(1),
  args: z.array(z.unknown()).optional(),
})

export interface RuntimeRestRouteOptions {
  endpoint?: string | false
  manager: RuntimeSessionManager
}

interface RestRequestContext {
  pathname: string
  requestPath: string
  url: URL
}

export function normalizeRuntimeRestEndpoint(input: unknown) {
  if (input === false) {
    return false
  }

  const value = typeof input === 'string' ? input.trim() : ''
  const endpoint = value || DEFAULT_RUNTIME_REST_ENDPOINT
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`
}

function writeJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  if (res.headersSent) {
    return
  }

  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

function writeOk(res: ServerResponse, result: unknown) {
  writeJson(res, 200, {
    ok: true,
    result,
  })
}

function writeError(res: ServerResponse, statusCode: number, error: unknown) {
  writeJson(res, statusCode, {
    ok: false,
    error: {
      message: error instanceof Error ? error.message : String(error),
    },
  })
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    return {}
  }

  return JSON.parse(raw) as unknown
}

function readBooleanParam(value: string | null) {
  if (value == null) {
    return undefined
  }
  return ['1', 'true', 'yes'].includes(value.toLowerCase())
}

function readNumberParam(value: string | null) {
  if (value == null || value.trim() === '') {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function readConnectionFromQuery(url: URL): RuntimeConnectionInput {
  return connectionSchema.parse(compactObject({
    projectPath: url.searchParams.get('projectPath') ?? undefined,
    timeout: readNumberParam(url.searchParams.get('timeout')),
    preferOpenedSession: readBooleanParam(url.searchParams.get('preferOpenedSession')),
  }))
}

function getRouteContext(req: IncomingMessage, endpoint: string | false): RestRequestContext | undefined {
  if (endpoint === false) {
    return undefined
  }

  const hostHeader = req.headers.host ?? '127.0.0.1'
  const url = new URL(req.url ?? '/', `http://${hostHeader}`)
  const pathname = url.pathname.replace(/\/+$/, '') || '/'
  const normalizedEndpoint = endpoint.replace(/\/+$/, '') || '/'

  if (pathname !== normalizedEndpoint && !pathname.startsWith(`${normalizedEndpoint}/`)) {
    return undefined
  }

  const requestPath = pathname === normalizedEndpoint
    ? '/'
    : pathname.slice(normalizedEndpoint.length)

  return {
    pathname,
    requestPath,
    url,
  }
}

function getAllowedMethods(pathname: string) {
  if (pathname === '/') {
    return ['GET']
  }
  if (pathname === '/connect' || pathname === '/route' || pathname === '/capture' || pathname === '/host-api') {
    return ['POST']
  }
  if (pathname === '/active-page' || pathname === '/page-stack') {
    return ['GET', 'POST']
  }
  if (pathname === '/console') {
    return ['GET', 'DELETE']
  }
  if (pathname === '/session') {
    return ['DELETE']
  }
  return []
}

function assertMethod(res: ServerResponse, method: string, requestPath: string) {
  const allowedMethods = getAllowedMethods(requestPath)
  if (allowedMethods.length === 0) {
    writeError(res, 404, `Not Found: ${requestPath}`)
    return false
  }
  if (!allowedMethods.includes(method)) {
    res.setHeader('allow', allowedMethods.join(', '))
    writeError(res, 405, `Method Not Allowed: ${method}`)
    return false
  }
  return true
}

async function readConnectionBody(req: IncomingMessage) {
  return connectionSchema.parse(await readJsonBody(req))
}

async function getActivePage(manager: RuntimeSessionManager, input: z.infer<typeof activePageBodySchema>) {
  return await manager.withPage(input, async (page) => {
    const [size, scrollTop, data] = await Promise.all([
      page.size().catch(() => null),
      page.scrollTop().catch(() => null),
      input.withData ? page.data().catch(() => null) : Promise.resolve(undefined),
    ])

    return compactObject({
      path: page.path,
      query: toSerializableValue(page.query),
      size: toSerializableValue(size),
      scrollTop: toSerializableValue(scrollTop),
      data: toSerializableValue(data),
    })
  })
}

async function handleRoot(res: ServerResponse, endpoint: string | false) {
  writeOk(res, {
    endpoint,
    routes: [
      'POST /connect',
      'POST /route',
      'GET|POST /active-page',
      'GET|POST /page-stack',
      'POST /capture',
      'POST /host-api',
      'GET|DELETE /console',
      'DELETE /session',
    ],
  })
}

async function handleConnect(req: IncomingMessage, res: ServerResponse, manager: RuntimeSessionManager) {
  const connection = await readConnectionBody(req)
  const result = await manager.withMiniProgram(connection, async (miniProgram) => {
    const page = await miniProgram.currentPage().catch(() => null)
    const systemInfo = await miniProgram.systemInfo().catch(() => null)
    return {
      connected: true,
      projectPath: connection.projectPath,
      resolvedProjectPath: manager.resolveProjectPath(connection.projectPath),
      currentPage: page ? { path: page.path, query: toSerializableValue(page.query) } : null,
      systemInfo: toSerializableValue(systemInfo),
    }
  })

  writeOk(res, result)
}

async function handleRoute(req: IncomingMessage, res: ServerResponse, manager: RuntimeSessionManager) {
  const input = routeBodySchema.parse(await readJsonBody(req))
  const result = await manager.withMiniProgram(input, async (miniProgram) => {
    const transition = input.transition ?? 'navigateTo'
    if (transition === 'navigateBack') {
      const page = await miniProgram.navigateBack()
      if (input.waitMs && page) {
        await page.waitFor(input.waitMs)
      }
      return {
        transition,
        activePage: page ? { path: page.path, query: toSerializableValue(page.query) } : null,
      }
    }

    if (!input.path) {
      throw new Error('transition 不是 navigateBack 时必须提供 path。')
    }

    const url = buildUrl(input.path, input.query)
    const page = await callRequiredMethod<Awaited<ReturnType<typeof miniProgram.currentPage>>>(
      miniProgram,
      transition,
      url,
    )
    if (input.waitMs && page) {
      await page.waitFor(input.waitMs)
    }

    return {
      transition,
      url,
      activePage: page ? { path: page.path, query: toSerializableValue(page.query) } : null,
    }
  })

  writeOk(res, result)
}

async function handleActivePage(req: IncomingMessage, res: ServerResponse, context: RestRequestContext, manager: RuntimeSessionManager) {
  const input = req.method === 'GET'
    ? activePageBodySchema.parse({
        ...readConnectionFromQuery(context.url),
        withData: readBooleanParam(context.url.searchParams.get('withData')),
      })
    : activePageBodySchema.parse(await readJsonBody(req))
  const result = await getActivePage(manager, input)
  writeOk(res, result)
}

async function handlePageStack(req: IncomingMessage, res: ServerResponse, context: RestRequestContext, manager: RuntimeSessionManager) {
  const connection = req.method === 'GET'
    ? readConnectionFromQuery(context.url)
    : await readConnectionBody(req)
  const result = await manager.withMiniProgram(connection, async (miniProgram) => {
    const stack = await miniProgram.pageStack()
    return stack.map(page => ({
      path: page.path,
      query: toSerializableValue(page.query),
    }))
  })

  writeOk(res, result)
}

async function handleCapture(req: IncomingMessage, res: ServerResponse, manager: RuntimeSessionManager) {
  const input = captureBodySchema.parse(await readJsonBody(req))
  const result = await manager.withMiniProgram(input, async (miniProgram) => {
    const screenshot = await miniProgram.screenshot()
    const buffer = typeof screenshot === 'string' ? Buffer.from(screenshot, 'base64') : Buffer.from(screenshot)

    if (input.outputPath) {
      const resolvedOutputPath = manager.resolveWorkspacePath(input.outputPath)
      await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true })
      await fs.writeFile(resolvedOutputPath, buffer)
      return {
        path: resolvedOutputPath,
        bytes: buffer.length,
      }
    }

    return {
      base64: buffer.toString('base64'),
      bytes: buffer.length,
    }
  })

  writeOk(res, result)
}

async function handleHostApi(req: IncomingMessage, res: ServerResponse, manager: RuntimeSessionManager) {
  const input = hostApiBodySchema.parse(await readJsonBody(req))
  const result = await manager.withMiniProgram(input, async (miniProgram) => {
    const args = input.args ?? []
    return {
      method: input.method,
      args: toSerializableValue(args),
      result: toSerializableValue(await miniProgram.callWxMethod(input.method, ...args)),
    }
  })

  writeOk(res, result)
}

async function handleConsole(req: IncomingMessage, res: ServerResponse, manager: RuntimeSessionManager) {
  const logs = manager.getLogs()
  if (req.method === 'DELETE') {
    manager.clearLogs()
  }

  writeOk(res, {
    count: logs.length,
    logs,
    cleared: req.method === 'DELETE',
  })
}

async function handleSession(req: IncomingMessage, res: ServerResponse, context: RestRequestContext, manager: RuntimeSessionManager) {
  const connection = context.url.searchParams.has('projectPath')
    ? readConnectionFromQuery(context.url)
    : await readConnectionBody(req)
  await manager.close(connection)
  writeOk(res, {
    closed: true,
    projectPath: connection.projectPath,
    resolvedProjectPath: manager.resolveProjectPath(connection.projectPath),
  })
}

/**
 * @description 处理 DevTools runtime REST 请求；返回 true 表示已命中 REST 路由。
 */
export async function handleRuntimeRestRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: RuntimeRestRouteOptions,
) {
  const endpoint = normalizeRuntimeRestEndpoint(options.endpoint)
  const context = getRouteContext(req, endpoint)
  if (!context) {
    return false
  }

  const method = req.method ?? 'GET'
  if (!assertMethod(res, method, context.requestPath)) {
    return true
  }

  try {
    if (context.requestPath === '/') {
      await handleRoot(res, endpoint)
    }
    else if (context.requestPath === '/connect') {
      await handleConnect(req, res, options.manager)
    }
    else if (context.requestPath === '/route') {
      await handleRoute(req, res, options.manager)
    }
    else if (context.requestPath === '/active-page') {
      await handleActivePage(req, res, context, options.manager)
    }
    else if (context.requestPath === '/page-stack') {
      await handlePageStack(req, res, context, options.manager)
    }
    else if (context.requestPath === '/capture') {
      await handleCapture(req, res, options.manager)
    }
    else if (context.requestPath === '/host-api') {
      await handleHostApi(req, res, options.manager)
    }
    else if (context.requestPath === '/console') {
      await handleConsole(req, res, options.manager)
    }
    else if (context.requestPath === '/session') {
      await handleSession(req, res, context, options.manager)
    }
  }
  catch (error) {
    writeError(res, error instanceof SyntaxError || error instanceof z.ZodError ? 400 : 500, error)
  }

  return true
}
