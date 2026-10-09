import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

interface AutomatorSessionIdentity {
  installationId: string
  port?: number
  projectPath: string
  sessionId?: string
}

interface PersistedAutomatorSession extends AutomatorSessionIdentity {
  updatedAt: string
  wsEndpoint: string
}

const SESSION_DIRECTORY = path.join(os.tmpdir(), 'weapp-vite-automator-sessions')

function resolveAutomatorSessionFilePath(options: AutomatorSessionIdentity) {
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

async function readSessionFile(filePath: string, options: AutomatorSessionIdentity) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
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
    return session as PersistedAutomatorSession
  }
  catch {
    return null
  }
}

/** 未携带安装身份、身份冲突或端口不符的缓存均不可用于连接。 */
export async function readPersistedAutomatorSession(options: AutomatorSessionIdentity) {
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
    return matches.length === 1 ? matches[0] : null
  }
  catch {
    return null
  }
}
