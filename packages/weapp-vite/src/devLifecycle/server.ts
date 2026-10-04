import type { ViteDevServer } from 'vite'

type CloseDevServer = () => Promise<void>

export interface DevServerCloseRecord {
  close: CloseDevServer
  gate?: (close: CloseDevServer) => Promise<void>
}

const serverCloseRecord = Symbol('weapp-vite:dev-server-close')
type LifecycleServer = ViteDevServer & { [serverCloseRecord]?: DevServerCloseRecord }
const dispatchedRecords = new WeakMap<CloseDevServer, { record: DevServerCloseRecord, close: CloseDevServer }>()
const dispatchedCloses = new WeakMap<CloseDevServer, CloseDevServer>()

function onceClose(close: CloseDevServer): CloseDevServer {
  let closing: Promise<void> | undefined
  return () => {
    if (!closing) {
      const completion = Promise.withResolvers<void>()
      closing = completion.promise
      try {
        completion.resolve(close())
      }
      catch (error) {
        completion.reject(error)
      }
    }
    return closing
  }
}

function wrapUserClose(server: ViteDevServer, close: CloseDevServer, previous: CloseDevServer): CloseDevServer {
  return onceClose(async () => {
    try {
      await close.call(server)
    }
    catch (error) {
      // 用户清理失败仍需释放下层宿主；已经调用过的下层入口会复用原关闭结果。
      try {
        await previous()
      }
      catch (cleanupError) {
        if (cleanupError !== error) {
          throw new AggregateError([error, cleanupError], 'User and host close failed', { cause: error })
        }
      }
      throw error
    }
  })
}

function dispatchClose(record: DevServerCloseRecord): CloseDevServer {
  const localClose = record.close
  let dispatched = dispatchedCloses.get(localClose)
  if (!dispatched) {
    // 用户包装器会保存旧 close；捕获这一层入口，不能回读后续替换后的链头。
    dispatched = () => record.gate ? record.gate(localClose) : localClose()
    dispatchedCloses.set(localClose, dispatched)
    dispatchedRecords.set(dispatched, { record, close: localClose })
  }
  return dispatched
}

/** 每代宿主持有独立资源关闭入口，Vite 原生交接同时复制该记录和公共方法。 */
export function getDevServerCloseRecord(server: ViteDevServer): DevServerCloseRecord {
  const host = server as LifecycleServer
  if (host[serverCloseRecord]) {
    return host[serverCloseRecord]
  }
  const record: DevServerCloseRecord = { close: onceClose(server.close.bind(server)) }
  // 保持可枚举，供 Vite 重启时的 Object.assign 一并交接；不修改调用方配置。
  host[serverCloseRecord] = record
  Object.defineProperty(host, 'close', {
    configurable: true,
    enumerable: true,
    get() {
      return dispatchClose(host[serverCloseRecord]!)
    },
    set(close: CloseDevServer) {
      const incoming = dispatchedRecords.get(close)
      if (incoming) {
        // Object.assign 先复制字符串键 close，后复制 symbol；提前接管新代而非包装旧代。
        host[serverCloseRecord] = incoming.record
        incoming.record.close = incoming.close
      }
      else {
        const current = host[serverCloseRecord]!
        current.close = wrapUserClose(server, close, current.close)
      }
    },
  })
  return record
}

/** 仅替换本代资源清理，公共退出等待边界始终留在最外层。 */
export function replaceDevServerClose(server: ViteDevServer, close: CloseDevServer): CloseDevServer {
  const record = getDevServerCloseRecord(server)
  const previous = record.close
  record.close = onceClose(() => close.call(server))
  return previous
}
