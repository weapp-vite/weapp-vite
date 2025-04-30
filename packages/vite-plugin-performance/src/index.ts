import type { Plugin } from 'vite'
import { createDefu } from 'defu'

type PluginHooks = keyof Plugin

const defuOverrideArray = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = value
    return true
  }
})

export interface OnHookExecutionParams {
  pluginName: string
  hookName: string
  args: any[]
  duration: number
}

export interface WrapPluginOptions {
  threshold?: number // 阈值，默认100ms
  onHookExecution?: (params: OnHookExecutionParams) => void
  hooks?: PluginHooks[]
  slient?: boolean
}

export function wrapPlugin(plugin: Plugin, options?: Partial<WrapPluginOptions>): Plugin {
  const wrapped = { ...plugin }
  const { threshold = 0, onHookExecution, hooks, slient } = defuOverrideArray<WrapPluginOptions, WrapPluginOptions[]>(
    options!,
    {
      threshold: 0,
      hooks: [
        'options',
        'buildStart',
        'resolveId',
        'load',
        'transform',
        'buildEnd',
        'generateBundle',
        'renderChunk',
        'writeBundle',
      ],
      slient: false,
    },
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
}
