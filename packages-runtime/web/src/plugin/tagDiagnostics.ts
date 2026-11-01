import type { WxmlTagDiagnostic } from '../compiler/wxml/types'
import type { WebPluginContext, WebResolvedConfig } from './hostTypes'
import type { WeappWebPluginOptions } from './types'
import { formatTagDiagnostic } from '../compiler/wxml/unknownTags'

/** 插件实例持有诊断状态；源码或注册作用域变化时替换对应 owner 的集合。 */
export function createTagDiagnosticReporter(options: WeappWebPluginOptions['runtime']) {
  const owners = new Map<string, Map<string, string>>()
  let config: WebResolvedConfig | undefined
  return {
    configure(value: WebResolvedConfig) {
      config = value
      owners.clear()
    },
    report(owner: string, diagnostics: WxmlTagDiagnostic[] | undefined, componentTags: Record<string, string> | undefined, context: WebPluginContext) {
      const level = options?.warnings?.level ?? 'warn'
      if (config?.command !== 'serve' || level === 'off') {
        return
      }
      const scope = JSON.stringify(Object.entries(componentTags ?? {}).sort(([a], [b]) => a.localeCompare(b)))
      const previous = owners.get(owner)
      const current = new Map<string, string>()
      for (const diagnostic of diagnostics ?? []) {
        const key = JSON.stringify([scope, diagnostic.filename, diagnostic.tag, diagnostic.reason])
        const message = `${formatTagDiagnostic(diagnostic)}${diagnostic.filename === owner ? '' : `（入口 ${owner}）`}`
        if (current.has(key)) {
          continue
        }
        current.set(key, message)
        if (options?.warnings?.dedupe !== false && previous?.get(key) === message) {
          continue
        }
        if (level === 'error') {
          // 构建上下文的 error 会抛出异常；这里仅提升日志级别。
          if (config.logger) {
            config.logger.error(message)
          }
          else {
            globalThis.console?.error(message)
          }
        }
        else {
          context.warn?.(message)
        }
      }
      owners.set(owner, current)
    },
  }
}
