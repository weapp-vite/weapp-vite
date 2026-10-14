import type { Writable } from 'node:stream'
import type { Plugin } from 'vite'
import path from 'node:path'
import { createBufferedBuildDiagnosticSink } from './sink'

export const AUTO_IMPORT_BUILD_HOOK_PREFIX = '[auto-import-build-hook] '
export const autoImportBuildHookNames = ['buildStart', 'resolveId', 'load', 'transform', 'moduleParsed', 'buildEnd', 'renderStart', 'renderChunk', 'generateBundle', 'writeBundle', 'closeBundle'] as const
type HookName = typeof autoImportBuildHookNames[number]
type Hook = (this: unknown, ...args: unknown[]) => unknown

export interface BuildHookEvent {
  id: number
  pluginIndex: number
  pluginName: string
  hookName: HookName
  status: 'started' | 'completed' | 'failed'
  timeOrigin: number
  startedAtMs: number
  endedAtMs?: number
  elapsedMs?: number
  moduleId?: string
  errorName?: string
}

export interface BuildHookOptions {
  roots: Array<{ path: string, label: string }>
  now?: () => number
  timeOrigin?: () => number
  observe?: (event: BuildHookEvent | BuildDiagnosticTerminal) => void
  output?: Writable
}

export interface BuildDiagnosticTerminal {
  kind: 'producer-end'
  schemaVersion: 2
  lastAssignedId: number
  pendingIds: number[]
  timeOrigin: number
  endedAtMs: number
  drained: boolean
  finalCloseHook: boolean
}

/** 模块标识保留查询串与虚拟前缀，路径只记录稳定的所属范围。 */
export function normalizeBuildDiagnosticText(value: string, roots: BuildHookOptions['roots']) {
  let normalized = value.replaceAll('\\', '/')
  for (const root of [...roots].sort((a, b) => b.path.length - a.path.length)) {
    normalized = normalized.replaceAll(root.path.replaceAll('\\', '/').replace(/\/$/, ''), root.label)
  }
  return normalized
}

function moduleId(hookName: HookName, args: unknown[], roots: BuildHookOptions['roots']) {
  const value = hookName === 'transform'
    ? args[1]
    : hookName === 'resolveId' || hookName === 'load'
      ? args[0]
      : undefined
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = normalizeBuildDiagnosticText(value, roots)
  return path.isAbsolute(normalized) || /^[a-z]:\//i.test(normalized) ? `<external>/${path.basename(normalized)}` : normalized
}

/** 仅测试 fixture 启用；保留原 hook 形态、过滤条件、顺序、上下文和异常身份。 */
export function createAutoImportBuildDiagnosticsPlugin(enabled: boolean, options: BuildHookOptions): Plugin | undefined {
  if (!enabled) {
    return undefined
  }
  const now = options.now ?? (() => performance.now())
  const timeOrigin = options.timeOrigin ?? (() => performance.timeOrigin)
  const sink = options.observe ? undefined : createBufferedBuildDiagnosticSink(options.output)
  const observe = options.observe ?? ((event) => {
    // 子进程输出已由原测量器捕获；写盘发生在该进程的测量结束后。
    sink!.write(`${AUTO_IMPORT_BUILD_HOOK_PREFIX}${JSON.stringify(event)}\n`)
  })
  let sequence = 0
  let observerFailed = false
  let closing: Promise<void> | undefined
  let resolvedPlugins: readonly Plugin[] = []
  const pendingIds = new Set<number>()
  const wrappedPlugins = new WeakSet<object>()
  const emit = (event: BuildHookEvent | BuildDiagnosticTerminal) => {
    try {
      observe(event)
    }
    catch {
      observerFailed = true
      // 诊断接收方不能改变构建结果或替换首个编译错误。
    }
  }
  const wrap = (original: Hook, pluginName: string, pluginIndex: number, hookName: HookName): Hook => function (this: unknown, ...args: unknown[]) {
    let event: BuildHookEvent
    try {
      event = { id: ++sequence, pluginName, pluginIndex, hookName, status: 'started', timeOrigin: timeOrigin(), startedAtMs: now(), moduleId: moduleId(hookName, args, options.roots) }
    }
    catch {
      return original.apply(this, args)
    }
    pendingIds.add(event.id)
    emit(event)
    const finish = (status: 'completed' | 'failed', error?: unknown) => {
      try {
        const endedAtMs = now()
        emit({ ...event, status, endedAtMs, elapsedMs: endedAtMs - event.startedAtMs, ...(status === 'failed' ? { errorName: error instanceof Error ? error.name : 'non-error' } : {}) })
        pendingIds.delete(event.id)
      }
      catch {
        // 保留开始记录，结束时钟故障不改变原 hook 的返回或异常。
      }
    }
    let result: unknown
    try {
      result = original.apply(this, args)
    }
    catch (error) {
      finish('failed', error)
      throw error
    }
    let then: unknown
    try {
      then = result && (typeof result === 'object' || typeof result === 'function') ? Reflect.get(result, 'then') : undefined
    }
    catch {
      return result
    }
    if (typeof then === 'function') {
      return then.call(result, (value: unknown) => {
        finish('completed')
        return value
      }, (error: unknown) => {
        finish('failed', error)
        throw error
      })
    }
    finish('completed')
    return result
  }
  const diagnostics: Plugin = {
    name: 'benchmark:auto-import-build-diagnostics',
    enforce: 'post',
    configResolved(config) {
      resolvedPlugins = config.plugins
      for (const [pluginIndex, plugin] of config.plugins.entries()) {
        if (plugin.name === 'benchmark:auto-import-build-diagnostics' || wrappedPlugins.has(plugin)) {
          continue
        }
        wrappedPlugins.add(plugin)
        const record = plugin as unknown as Record<string, unknown>
        for (const hookName of autoImportBuildHookNames) {
          const original = record[hookName]
          if (typeof original === 'function') {
            record[hookName] = Object.assign(wrap(original as Hook, plugin.name, pluginIndex, hookName), original)
          }
          else if (original && typeof original === 'object' && 'handler' in original && typeof original.handler === 'function') {
            record[hookName] = { ...original, handler: wrap(original.handler as Hook, plugin.name, pluginIndex, hookName) }
          }
        }
      }
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        return closing ??= (async () => {
          try {
            const drained = await sink?.flush() ?? true
            const postClosePlugins = resolvedPlugins.filter(plugin => typeof plugin.closeBundle === 'object' && plugin.closeBundle.order === 'post')
            const finalCloseHook = postClosePlugins.at(-1) === diagnostics && resolvedPlugins.filter(plugin => plugin === diagnostics).length === 1
            emit({ kind: 'producer-end', schemaVersion: 2, lastAssignedId: sequence, pendingIds: [...pendingIds], timeOrigin: timeOrigin(), endedAtMs: now(), drained: drained && !observerFailed, finalCloseHook })
            await sink?.flush()
          }
          catch {
            // 缺失终结记录会使诊断不完整；不能替换原始构建异常。
          }
          finally {
            sink?.dispose()
          }
        })()
      },
    },
  }
  return diagnostics
}
