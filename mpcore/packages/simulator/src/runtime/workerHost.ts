import type { HeadlessWorker, HeadlessWorkerApis } from '../host/wx/workers'
import { join, normalize } from 'pathe'
import { RuntimeScheduler } from '../kernel/scheduler'
import { resolveMiniProgramModule } from './moduleResolution'

interface WorkerModule { exports: any }
type Execute = (source: string, file: string, module: WorkerModule, require: (id: string) => any) => void

interface WorkerHostOptions {
  root: string
  read: (file: string) => string | undefined
  createExecutor: (globals: Record<string, any>) => Execute
  console: Console
}

/** 两种 simulator 共用消息与生命周期；每个 worker 独立模块缓存、全局对象及计时器。 */
export function createWorkerHost(options: WorkerHostOptions) {
  const active = new Set<HeadlessWorker>()
  let closed = false
  const configuredRoot = () => {
    const app = JSON.parse(options.read(join(options.root, 'app.json')) ?? '{}') as { workers?: string | { path: string, isSubpackage?: boolean } }
    return app.workers
  }
  const apis: HeadlessWorkerApis = {
    preDownloadSubpackage(option) {
      const config = configuredRoot()
      if (option.packageType !== 'workers' || typeof config !== 'object' || !config.isSubpackage) {
        const error = new Error('preDownloadSubpackage:fail workers subpackage is not configured')
        option.fail?.(error)
        option.complete?.()
        return
      }
      const result = { errMsg: 'preDownloadSubpackage:ok' }
      option.success?.(result)
      option.complete?.(result)
    },
    createWorker(scriptPath) {
      if (closed) {
        throw new Error('createWorker:fail runtime has closed')
      }
      const config = configuredRoot()
      const directory = typeof config === 'string' ? config : config?.path
      if (!directory || typeof scriptPath !== 'string' || !scriptPath.endsWith('.js')) {
        throw new Error('createWorker:fail invalid worker path')
      }
      const root = normalize(join(options.root, directory))
      const entry = normalize(join(options.root, scriptPath))
      const inside = (file: string) => file.startsWith(`${root}/`)
      if (!inside(entry) || options.read(entry) === undefined) {
        throw new Error('createWorker:fail worker entry is outside the configured directory or missing')
      }
      const messages = new Set<(message: any) => void>()
      const incoming = new Set<(message: any) => void>()
      const errors = new Set<(error: { message: string }) => void>()
      const cache = new Map<string, WorkerModule>()
      let terminated = false
      const scheduler = new RuntimeScheduler((error) => {
        const value = { message: error instanceof Error ? error.message : String(error) }
        if (errors.size) {
          for (const listener of errors) {
            listener(value)
          }
        }
        else {
          options.console.error(value.message)
        }
      })
      const post = (listeners: Set<(message: any) => void>, message: unknown) => {
        if (terminated) {
          return
        }
        const copy = structuredClone(message)
        scheduler.setTimeout(() => {
          for (const listener of [...listeners]) {
            if (terminated) {
              break
            }
            listener(copy)
          }
        }, 0)
      }
      const globals: Record<string, any> = {
        // worker 没有页面宿主；浏览器执行器也不能回退读取主页面 wx/App。
        wx: undefined,
        App: undefined,
        Page: undefined,
        Component: undefined,
        getApp: undefined,
        console: options.console,
        worker: { onMessage: (listener: (message: any) => void) => incoming.add(listener), postMessage: (message: unknown) => post(messages, message) },
        setTimeout: scheduler.setTimeout.bind(scheduler),
        clearTimeout: scheduler.clearTimeout.bind(scheduler),
        setInterval: scheduler.setInterval.bind(scheduler),
        clearInterval: scheduler.clearInterval.bind(scheduler),
      }
      globals.globalThis = globals
      const execute = options.createExecutor(globals)
      const load = (file: string): any => {
        if (terminated) {
          return undefined
        }
        if (!inside(file)) {
          throw new Error('Worker require cannot leave its configured directory')
        }
        if (cache.has(file)) {
          return cache.get(file)!.exports
        }
        const source = options.read(file)
        if (source === undefined) {
          throw new Error(`Missing worker module: ${file}`)
        }
        if (file.endsWith('.json')) {
          return JSON.parse(source)
        }
        const module: WorkerModule = { exports: {} }
        cache.set(file, module)
        const require = Object.assign((request: string) => {
          const target = resolveMiniProgramModule(file, request, root, candidate => options.read(candidate) !== undefined)
          if (!target) {
            throw new Error(`Cannot resolve worker module: ${request}`)
          }
          return load(target)
        }, { async: (request: string) => Promise.resolve().then(() => require(request)) })
        try {
          execute(source, file, module, require)
        }
        catch (error) {
          cache.delete(file)
          throw error
        }
        return module.exports
      }
      const worker: HeadlessWorker = {
        onMessage: (listener) => { messages.add(listener) },
        offMessage: (listener) => {
          if (listener) {
            messages.delete(listener)
          }
          else {
            messages.clear()
          }
        },
        postMessage: message => post(incoming, message),
        onError: (listener) => { errors.add(listener) },
        offError: (listener) => {
          if (listener) {
            errors.delete(listener)
          }
          else {
            errors.clear()
          }
        },
        terminate() {
          if (terminated) {
            return
          }
          terminated = true
          scheduler.close()
          messages.clear()
          incoming.clear()
          errors.clear()
          cache.clear()
          active.delete(worker)
        },
      }
      active.add(worker)
      scheduler.setTimeout(() => load(entry), 0)
      return worker
    },
  }
  return {
    apis,
    close() {
      closed = true
      for (const worker of active) {
        worker.terminate()
      }
    },
  }
}
