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

function resolveAutomatorSessionFilePath(options: AutomatorSessionIdentity) {
  const key = JSON.stringify([options.installationId, path.resolve(options.projectPath), options.sessionId?.trim() || null, options.port || null])
  return path.join(os.tmpdir(), 'weapp-vite-automator-sessions', `${createHash('sha256').update(key).digest('hex')}.json`)
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

/** 未携带安装身份、身份冲突或端口不符的缓存均不可用于连接。 */
export async function readPersistedAutomatorSession(options: AutomatorSessionIdentity) {
  try {
    const raw = await fs.readFile(resolveAutomatorSessionFilePath(options), 'utf8')
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
