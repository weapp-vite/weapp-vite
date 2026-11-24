import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

interface AutomatorSessionIdentity {
  installationId: string
  port?: number
  projectPath: string
  sessionId?: string
}

interface AutomatorSessionReadOptions extends AutomatorSessionIdentity {
  signal?: AbortSignal
  timeout?: number
}

interface PersistedAutomatorSession extends AutomatorSessionIdentity {
  updatedAt: string
  wsEndpoint: string
}

const SESSION_DIRECTORY = path.join(os.tmpdir(), 'weapp-vite-automator-sessions')
const DEFAULT_SESSION_PROBE_TIMEOUT_MS = 500

/** 内部工具复用会话键；不从包入口公开缓存路径契约。 */
export function resolveAutomatorSessionFilePath(options: AutomatorSessionIdentity) {
  const key = JSON.stringify([options.installationId, path.resolve(options.projectPath), options.sessionId?.trim() || null, options.port || null])
  return path.join(SESSION_DIRECTORY, `${createHash('sha256').update(key).digest('hex')}.json`)
}

/** 只保存所选安装的端点，不覆盖其他安装或旧版会话记录。 */
export async function persistAutomatorSession(options: AutomatorSessionIdentity & { wsEndpoint: string, signal?: AbortSignal }) {
  options.signal?.throwIfAborted()
  const filePath = resolveAutomatorSessionFilePath(options)
  const payload: PersistedAutomatorSession = {
    installationId: options.installationId,
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

async function isEndpointListening(port: number, options: AutomatorSessionReadOptions) {
  options.signal?.throwIfAborted()
  const timeoutMs = Math.max(1, Math.min(options.timeout ?? DEFAULT_SESSION_PROBE_TIMEOUT_MS, DEFAULT_SESSION_PROBE_TIMEOUT_MS))

  return await new Promise<boolean>((resolve) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout>
    let onAbort: () => void
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const finish = (listening: boolean) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
      socket.destroy()
      resolve(listening)
    }
    onAbort = () => finish(false)
    timeout = setTimeout(finish, timeoutMs, false)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    options.signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function readSessionFile(filePath: string, options: AutomatorSessionReadOptions) {
  try {
    options.signal?.throwIfAborted()
    const raw = await fs.readFile(filePath, { encoding: 'utf8', signal: options.signal })
    const payload: unknown = JSON.parse(raw)
    if (!payload || typeof payload !== 'object') {
      return null
    }
    const session = payload as Partial<PersistedAutomatorSession>
    if (session.installationId !== options.installationId || session.projectPath !== path.resolve(options.projectPath)) {
      return null
    }
    if ((options.sessionId && session.sessionId !== options.sessionId) || (options.port && session.port !== options.port)) {
      return null
    }
    if (typeof session.wsEndpoint !== 'string') {
      return null
    }
    const endpoint = new URL(session.wsEndpoint)
    if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port
      || (options.port && Number(endpoint.port) !== options.port)) {
      return null
    }
    const listening = await isEndpointListening(Number(endpoint.port), options)
    options.signal?.throwIfAborted()
    if (!listening) {
      const current = await fs.readFile(filePath, { encoding: 'utf8', signal: options.signal }).catch(() => {
        options.signal?.throwIfAborted()
        return undefined
      })
      if (current === raw) {
        await fs.rm(filePath, { force: true }).catch(() => {})
      }
      return null
    }
    return session as PersistedAutomatorSession
  }
  catch {
    options.signal?.throwIfAborted()
    return null
  }
}

/** 未携带安装身份、身份冲突或端口不符的缓存均不可用于连接。 */
export async function readPersistedAutomatorSession(options: AutomatorSessionReadOptions) {
  const direct = await readSessionFile(resolveAutomatorSessionFilePath(options), options)
  if (direct || !options.sessionId || options.port) {
    return direct
  }

  // 受管启动为命名会话分配动态端口；调用方只持有 sessionId 时，按安装、项目和会话名回查。
  // 多个端口同时匹配表示归属不明确，必须拒绝连接，避免误连其他宿主。
  try {
    const entries = await fs.readdir(SESSION_DIRECTORY)
    const matches: PersistedAutomatorSession[] = []
    for (const entry of entries) {
      if (!entry.endsWith('.json')) {
        continue
      }
      const session = await readSessionFile(path.join(SESSION_DIRECTORY, entry), options)
      if (session) {
        matches.push(session)
      }
    }
    const endpoints = new Set(matches.map(session => session.wsEndpoint))
    return endpoints.size === 1 ? matches[0] ?? null : null
  }
  catch {
    options.signal?.throwIfAborted()
    return null
  }
}
