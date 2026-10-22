import type Connection from '../Connection'
import { stringify } from '../internal/compat'
import { createComponentCallerSession } from './runtime'

interface Target {
  nodeId: number
  pageId: number
}
interface RemoteObject {
  type?: string
  subtype?: string
  objectId?: string
  value?: any
  unserializableValue?: string
  description?: string
}
interface RuntimeResult {
  result?: RemoteObject
  exceptionDetails?: { text?: string }
}
const queues = new WeakMap<Connection, Promise<void>>()
const blocked = new WeakMap<Connection, Error>()
interface CleanupOwner {
  cleanup: () => Promise<void>
}
const owners = new WeakMap<Connection, Set<CleanupOwner>>()
const TIMEOUT = 2_500

/** 关闭连接前确认全部自有 listener 已移除；失败时保留 token 与可重试的所有权。 */
export function cleanupComponentCallers(connection: Connection): Promise<void> | undefined {
  const pending = owners.get(connection)
  if (!pending?.size) {
    return undefined
  }
  return (async () => {
    const errors: unknown[] = []
    for (const owner of [...pending]) {
      try {
        await owner.cleanup()
      }
      catch (error) {
        errors.push(error)
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, 'Component caller cleanup remains incomplete', { cause: errors[0] })
    }
    blocked.delete(connection)
  })()
}

function result(response: RuntimeResult) {
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? 'Component caller Runtime exception', { cause: response.exceptionDetails })
  }
  if (!response.result) {
    throw new Error('Component caller Runtime result is missing')
  }
  return response.result
}

function serializeArguments(args: any[]) {
  // 保留 Connection.send 中 params.args 的路径，循环引用 marker 也保持原契约。
  const payload = JSON.parse(stringify({ params: { args } })) as { params: { args: unknown[] } }
  return JSON.stringify(payload.params.args)
}

/** 保持原 SDK 的 returnByValue 解包，不等待业务返回的 Promise。 */
async function unwrap(connection: Connection, remote: RemoteObject): Promise<any> {
  if (remote.subtype === 'null') {
    return null
  }
  if (remote.type === 'undefined') {
    return undefined
  }
  if (remote.value !== undefined) {
    return remote.value
  }
  if (remote.unserializableValue) {
    const value = remote.unserializableValue
    if (/^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1))
    }
    if (['NaN', 'Infinity', '-Infinity', '-0'].includes(value)) {
      return Number(value)
    }
    throw new Error(`Unsupported component return value: ${value}`)
  }
  if (remote.objectId) {
    try {
      const converted: RuntimeResult = await connection.send('App.CDPCommand', {
        domain: 'Runtime',
        method: 'callFunctionOn',
        params: {
          objectId: remote.objectId,
          functionDeclaration: 'function () { try { return JSON.stringify(this) } catch { return String(this) } }',
          returnByValue: true,
        },
      }, { timeout: TIMEOUT })
      if (converted.result?.value !== undefined) {
        try {
          return JSON.parse(converted.result.value)
        }
        catch {
          return converted.result.value
        }
      }
    }
    catch {
      // 与 SDK 相同：仅返回值的二次转换失败时使用 description，不重新派发业务。
    }
  }
  return remote.description ?? `[${remote.type}]`
}

async function invoke(connection: Connection, target: Target, method: string, args: any[], native?: () => Promise<any>) {
  let token: string | undefined
  let owner: CleanupOwner | undefined
  const errors: unknown[] = []
  let cleanupFailed = false
  let nativeBackend = false
  let value: any
  const cdp = async (domain: string, command: string, params: Record<string, unknown>) => {
    return await connection.send('App.CDPCommand', { domain, method: command, params }, { timeout: TIMEOUT })
  }
  const wrapper = async (body: string) => result(await cdp('Runtime', 'callFunctionOn', {
    objectId: token,
    functionDeclaration: `function () { return ${body} }`,
    arguments: [],
    returnByValue: true,
  }))
  try {
    if (!Number.isSafeInteger(target.nodeId) || target.nodeId < 0 || !Number.isSafeInteger(target.pageId)) {
      throw new Error('Invalid component caller native target')
    }
    const page = await connection.send('App.getCurrentPage', {}, { timeout: TIMEOUT })
    if (page.pageId !== target.pageId) {
      throw new Error('Component caller target is not on the current page')
    }
    const created = result(await cdp('Runtime', 'evaluate', {
      expression: `(${createComponentCallerSession.toString()})(${JSON.stringify(target)}, 10000)`,
      returnByValue: false,
    }))
    if (!created.objectId) {
      throw new Error('Component caller session has no owned Runtime token')
    }
    token = created.objectId
    let cleaning: Promise<void> | undefined
    let disposed = false
    let released = false
    owner = {
      cleanup() {
        cleaning ??= (async () => {
          if (released) {
            return
          }
          if (!disposed) {
            const snapshot = (await wrapper('this.dispose()')).value
            if (snapshot?.state !== 'disposed' || (snapshot.added && !snapshot.removed)) {
              throw new Error('Component caller listener removal was not confirmed')
            }
            disposed = true
          }
          await cdp('Runtime', 'releaseObject', { objectId: token })
          released = true
          owners.get(connection)?.delete(owner!)
        })().catch((error: unknown) => {
          cleaning = undefined
          throw error
        })
        return cleaning
      },
    }
    let pending = owners.get(connection)
    if (!pending) {
      pending = new Set()
      owners.set(connection, pending)
    }
    pending.add(owner)
    const backend = (await wrapper('this.backend')).value
    if (backend === 'glass-easel') {
      nativeBackend = true
    }
    else if (backend === 'exparser') {
      const argumentSource = serializeArguments(args)
      await wrapper('this.arm()')
      // 此响应 token 属于另一个 ContextManager，只触发原生精确解析，不读取或释放它。
      await cdp('WxComponent', 'resolveComponentCaller', { nodeId: target.nodeId })
      await wrapper('this.disarm()')
      value = await unwrap(connection, await wrapper(`this.invoke(${JSON.stringify(method)}, ${argumentSource})`))
    }
    else {
      throw new Error('Unknown component caller backend')
    }
  }
  catch (error) {
    errors.push(error)
  }
  finally {
    if (owner) {
      try {
        await owner.cleanup()
      }
      catch (error) {
        errors.push(error)
        cleanupFailed = true
      }
    }
  }
  if (cleanupFailed) {
    blocked.set(connection, new Error('Component caller cleanup failed; reconnect before invoking another component', { cause: errors[0] }))
  }
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length) {
    throw new AggregateError(errors, 'Component caller invocation and cleanup failed', { cause: errors[0] })
  }
  if (nativeBackend) {
    if (!native) {
      throw new Error('Native component backend requires the original protocol')
    }
    return await native()
  }
  return value
}

/** 同一连接串行观察 resolver，避免多个组件误认彼此的桥接消息。 */
export async function invokeComponentMethod(connection: Connection, target: Target, method: string, args: any[], native?: () => Promise<any>): Promise<any> {
  const previous = queues.get(connection) ?? Promise.resolve()
  const pending = previous.then(async () => {
    const failure = blocked.get(connection)
    if (failure) {
      throw failure
    }
    return await invoke(connection, target, method, args, native)
  })
  const settled = pending.then(() => {}, () => {})
  queues.set(connection, settled)
  try {
    return await pending
  }
  finally {
    if (queues.get(connection) === settled) {
      queues.delete(connection)
    }
  }
}
