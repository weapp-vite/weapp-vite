import type { Plugin } from 'vite'
import path from 'node:path'
import { normalizePath } from 'vite'
import { createPackageImportsCache } from './packageCache'
import { packageImportsConditions, selectPackageImportsPostfix } from './select'

const pluginName = 'weapp-vite:package-imports-query'

function splitPostfix(id: string) {
  const index = id.search(/[?#]/)
  return index < 0 ? { file: id, postfix: '' } : { file: id.slice(0, index), postfix: id.slice(index) }
}

function createSessionPlugin(cache = createPackageImportsCache(), release = () => {}): Plugin {
  return {
    name: pluginName,
    enforce: 'pre',
    perEnvironmentWatchChangeDuringDev: true,
    config() {
      cache.clear()
    },
    configResolved() {
      cache.clear()
    },
    watchChange(id) {
      if (path.basename(id.replace(/[?#].*$/, '')) === 'package.json') {
        cache.clear()
      }
    },
    closeBundle() {
      cache.clear()
      if (!this.meta.watchMode || this.environment.config.command === 'serve') {
        release()
      }
    },
    closeWatcher() {
      cache.clear()
      release()
    },
    resolveId: {
      filter: { id: /^#/ },
      async handler(id, importer, options) {
        if (!importer || !/[?#]/.test(id.slice(1)) || !path.isAbsolute(importer)) {
          return null
        }
        // 先走完整请求，使前置自定义 resolver、external 和原始错误保持原有优先级。
        const original = await this.resolve(id, importer, { ...options, skipSelf: true })
        if (!original || original.external) {
          return original
        }
        const lookup = await cache.find(path.dirname(importer.replace(/[?#].*$/, '')))
        for (const candidate of lookup.candidates) {
          this.addWatchFile(candidate)
        }
        if (!lookup.package) {
          return original
        }
        const { data, file } = lookup.package
        const conditions = packageImportsConditions(this.environment.config.resolve.conditions, this.environment.config.isProduction, options.kind === 'require-call')
        const selection = selectPackageImportsPostfix(data, id, conditions)
        if (!selection?.originalTarget) {
          return original
        }
        const originalPath = splitPostfix(original.id)
        if (originalPath.postfix !== splitPostfix(selection.originalTarget).postfix) {
          return original
        }
        const resolved = await this.resolve(selection.key, importer, { ...options, skipSelf: true })
        if (!resolved) {
          return original
        }
        const selectedFile = selection.target?.startsWith('.') ? normalizePath(path.resolve(path.dirname(file), splitPostfix(selection.target).file)) : selection.target
        // 通配符后缀可能触发扩展名补全或真实路径解析，因此同时核对映射路径和委派后的文件。
        if (originalPath.file !== selectedFile && (resolved.external || originalPath.file !== splitPostfix(resolved.id).file)) {
          return original
        }
        return { ...resolved, id: resolved.id + selection.postfix }
      },
    },
  }
}

/** 每个宿主和环境都创建独立的钩子对象及 package.json 缓存。 */
export function createPackageImportsQueryPlugin(): Plugin {
  const sessions = new Set<ReturnType<typeof createPackageImportsCache>>()
  function createSession(retained = false) {
    const cache = createPackageImportsCache()
    sessions.add(cache)
    return createSessionPlugin(cache, () => {
      if (!retained) {
        sessions.delete(cache)
      }
    })
  }
  function clearSessions() {
    for (const cache of sessions) {
      cache.clear()
    }
  }
  return {
    ...createSession(true),
    config: clearSessions,
    configResolved: clearSessions,
    applyToEnvironment() {
      const { config: _config, configResolved: _configResolved, ...plugin } = createSession()
      return plugin
    },
  }
}
