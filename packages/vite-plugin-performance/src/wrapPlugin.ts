import type { Plugin } from 'vite'
import type { WrapPluginOptions } from './types'
import { getDefaultOptions } from './defaults'
import { defuOverrideArray } from './utils'

export function wrapPlugin(maybePlugin: Plugin, options?: Partial<WrapPluginOptions>): Plugin
export function wrapPlugin(maybePlugin: Plugin[], options?: Partial<WrapPluginOptions>): Plugin[]
export function wrapPlugin(maybePlugin: Plugin | Plugin[], options?: Partial<WrapPluginOptions>): Plugin | Plugin[] {
  const isArr = Array.isArray(maybePlugin)
  const plugins = isArr ? maybePlugin : [maybePlugin]

  const wrappedPlugins = plugins.map((plugin) => {
    const wrapped = { ...plugin }
    const { threshold = 0, onHookExecution, hooks, slient } = defuOverrideArray<WrapPluginOptions, WrapPluginOptions[]>(
      options!,
      getDefaultOptions(),
    )
    if (Array.isArray(hooks)) {
      // 遍历插件的所有 Hook，包装每个 Hook
      for (const hook of hooks) {
        if (typeof plugin[hook] === 'function') {
          // 包装每个 hook 函数
          wrapped[hook] = async function (...args: any[]) {
            const start = performance.now() // 开始时间

            // 执行原始的 Hook
            const result = await plugin[hook]?.apply(this, args)

            const end = performance.now() // 结束时间
            const duration = Math.round(end - start)
            if (duration >= threshold) {
              const pluginName = plugin.name
              if (!slient) {
                console.log(`[${pluginName}] ${hook.padEnd(20)} ⏱ ${duration.toFixed(2).padStart(6)} ms`)
              }
              onHookExecution?.({
                pluginName,
                hookName: hook,
                args,
                duration,
              })
            }

            return result // 返回原始结果
          }
        }
      }
    }
    return wrapped
  })

  return isArr ? wrappedPlugins : wrappedPlugins[0]
}
