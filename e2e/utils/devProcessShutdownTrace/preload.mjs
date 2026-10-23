import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { threadId } from 'node:worker_threads'

let restore = () => {}

/** 只撤回本诊断仍持有的方法包装，精确恢复原属性并清理未引用计时器。 */
export function restoreDevProcessShutdownTrace() {
  restore()
}

function reportFailure(error) {
  try {
    // 诊断写出失败不能改变 CLI 的控制流、退出码或资源生命周期。
    fs.writeSync(2, `[dev-shutdown-trace-error] ${JSON.stringify({ message: String(error) })}\n`)
  }
  catch {}
}

try {
  const directory = process.env.WEAPP_VITE_DEV_SHUTDOWN_TRACE_DIR
  const identity = process.env.WEAPP_VITE_DEV_SHUTDOWN_TRACE_ID
  if (directory && identity) {
    fs.mkdirSync(directory, { recursive: true })
    const output = path.join(directory, `shutdown-${identity}-${process.pid}-${threadId}.jsonl`)
    const started = performance.now()
    let disconnected = false
    let observing = true
    const methods = []
    const timers = new Set()
    restore = () => {
      if (!observing) {
        return
      }
      observing = false
      for (const timer of timers) {
        clearTimeout(timer)
      }
      timers.clear()
      for (const { method, descriptor, wrapper } of methods) {
        try {
          if (Object.getOwnPropertyDescriptor(process, method)?.value !== wrapper) {
            continue
          }
          if (descriptor) {
            Object.defineProperty(process, method, descriptor)
          }
          else {
            delete process[method]
          }
        }
        catch (error) {
          reportFailure(error)
        }
      }
    }
    const wrap = (method, wrapper) => {
      const descriptor = Object.getOwnPropertyDescriptor(process, method)
      Object.defineProperty(process, method, {
        configurable: descriptor?.configurable ?? true,
        enumerable: descriptor?.enumerable ?? true,
        writable: descriptor && 'writable' in descriptor ? descriptor.writable : true,
        value: wrapper,
      })
      methods.push({ method, descriptor, wrapper })
    }
    const write = (event, detail = {}) => {
      try {
        fs.appendFileSync(output, `${JSON.stringify({ event, at: new Date().toISOString(), elapsedMs: performance.now() - started, pid: process.pid, threadId, ...detail })}\n`)
      }
      catch (error) {
        reportFailure(error)
      }
    }
    const listeners = event => process.listeners(event).map(listener => listener.name || '(anonymous)')
    const resourceKeys = ['type', 'is_active', 'is_referenced', 'address', 'fd', 'readable', 'writable', 'localEndpoint', 'remoteEndpoint', 'filename', 'repeat', 'firesInMsFromNow', 'expired']
    const summarizeResource = resource => Object.fromEntries(resourceKeys.filter(key => key in resource).map(key => [key, resource[key]]))
    const snapshot = (event) => {
      try {
        const report = process.report.getReport()
        write(event, {
          connected: process.connected,
          exitCode: process.exitCode,
          node: process.version,
          platform: process.platform,
          resources: process.getActiveResourcesInfo(),
          handles: process._getActiveHandles().map(handle => ({
            type: handle.constructor?.name,
            hasRef: typeof handle.hasRef === 'function' ? handle.hasRef() : undefined,
            fd: handle.fd,
            destroyed: handle.destroyed,
            readable: handle.readable,
            writable: handle.writable,
          })),
          // 完整 report 含进程环境；只保留资源与 worker 摘要。
          libuv: report.libuv.map(summarizeResource),
          workers: report.workers?.map(worker => ({ threadId: worker.header?.threadId, libuv: worker.libuv?.map(summarizeResource) })),
          listeners: { SIGINT: listeners('SIGINT'), SIGTERM: listeners('SIGTERM'), disconnect: listeners('disconnect') },
        })
      }
      catch (error) {
        write('CAPTURE_ERROR', { eventName: event, message: String(error) })
      }
    }

    for (const method of ['off', 'removeListener']) {
      const original = process[method]
      wrap(method, function (...args) {
        const result = Reflect.apply(original, this, args)
        const [event, listener] = args
        if (observing && this === process && disconnected && ['SIGINT', 'SIGTERM', 'disconnect'].includes(event)) {
          try {
            write('LISTENER_REMOVED', { method, eventName: event, listener: listener.name || '(anonymous)', remaining: listeners(event) })
          }
          catch (error) {
            reportFailure(error)
          }
        }
        return result
      })
    }

    const emit = process.emit
    // 不新增 disconnect/beforeExit/exit 监听器；Node IPC 的引用计数保持原样。
    wrap('emit', function (event, ...args) {
      if (!observing || this !== process) {
        return Reflect.apply(emit, this, [event, ...args])
      }
      if (event === 'disconnect') {
        disconnected = true
        snapshot('IPC_DISCONNECT_BEFORE')
        try {
          return Reflect.apply(emit, this, [event, ...args])
        }
        finally {
          snapshot('IPC_DISCONNECT_AFTER')
          for (const delay of [0, 1_000, 5_000, 20_000, 60_000, 85_000]) {
            if (!observing) {
              break
            }
            let timer
            try {
              timer = setTimeout(() => {
                timers.delete(timer)
                if (observing) {
                  snapshot(`POST_DISCONNECT_${delay}MS`)
                }
              }, delay)
              timer.unref()
              timers.add(timer)
            }
            catch (error) {
              if (timer) {
                clearTimeout(timer)
              }
              reportFailure(error)
            }
          }
        }
      }
      if (event === 'beforeExit' || event === 'exit') {
        snapshot(`${event === 'exit' ? 'PROCESS_EXIT' : 'BEFORE_EXIT'}_${args[0]}`)
      }
      return Reflect.apply(emit, this, [event, ...args])
    })
    snapshot('OBSERVER_READY')
  }
}
catch (error) {
  restoreDevProcessShutdownTrace()
  reportFailure(error)
}
