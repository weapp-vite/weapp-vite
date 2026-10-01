import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createConnection } from 'node:net'
import path from 'node:path'
import process from 'node:process'

export class DoctorProbeTimeout extends Error {}

/** 为只读 RPC 保留有界等待，未完成的宿主任务不被描述为成功。 */
export async function withProbeTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DoctorProbeTimeout()), ms)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

/** 仅检查文件及平台执行条件，不执行 CLI 或项目配置。 */
export async function inspectDoctorCli(cliPath: string) {
  try {
    if (!(await stat(cliPath)).isFile()) {
      return false
    }
    if (process.platform === 'win32' && !['.exe', '.cmd', '.bat', '.com'].includes(path.extname(cliPath).toLowerCase())) {
      return false
    }
    await access(cliPath, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
    return true
  }
  catch {
    return false
  }
}

/** TCP 可达只证明监听存在，不证明宿主身份；仅销毁本次创建的 socket。 */
export async function inspectDoctorListener(port: number): Promise<'listening' | 'not-listening' | 'timeout' | 'unavailable' | 'invalid-port'> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'invalid-port'
  }
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    let settled = false
    const finish = (result: 'listening' | 'not-listening' | 'timeout' | 'unavailable') => {
      if (!settled) {
        settled = true
        socket.destroy()
        resolve(result)
      }
    }
    socket.setTimeout(1_000, () => finish('timeout'))
    socket.once('connect', () => finish('listening'))
    socket.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'ECONNREFUSED' ? 'not-listening' : 'unavailable'))
  })
}

/** 宿主版本只保留数值版本，不透传任意 Tool.getInfo 字段。 */
export function readDoctorHostVersions(info: unknown): { ide?: string, sdk?: string } {
  if (!info || typeof info !== 'object') {
    return {}
  }
  const version = (value: unknown) => typeof value === 'string' && value.length <= 64 && /^\d+(?:\.\d+){1,3}$/.test(value) ? value : undefined
  return {
    ide: version('version' in info ? info.version : undefined),
    sdk: version('SDKVersion' in info ? info.SDKVersion : undefined),
  }
}

/** 页面查询参数可能包含业务凭据，只保留相对逻辑路由。 */
export function readDoctorRoute(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  const route = value.split(/[?#]/, 1)[0]!
  if (!route || route.startsWith('/') || route.length > 256 || route.includes('..') || /[\\:\s]/.test(route)) {
    return undefined
  }
  return route
}
