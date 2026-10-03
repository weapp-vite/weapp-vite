import type { Plugin } from 'vite'
import path from 'node:path'

const hooks = new Set([
  'buildStart',
  'resolveId',
  'resolveDynamicImport',
  'load',
  'transform',
  'moduleParsed',
  'buildEnd',
  'renderStart',
  'renderChunk',
  'augmentChunkHash',
  'renderDynamicImport',
  'resolveFileUrl',
  'resolveImportMeta',
  'generateBundle',
  'writeBundle',
  'closeBundle',
  'renderError',
  'outputOptions',
  'banner',
  'footer',
  'intro',
  'outro',
])

function wrapPluginOptions(value: unknown, wrap: (plugin: Plugin) => Plugin): unknown {
  if (Array.isArray(value)) {
    return value.map(item => wrapPluginOptions(item, wrap))
  }
  if (value && typeof value === 'object') {
    if ('then' in value && typeof value.then === 'function') {
      return Promise.resolve(value).then(item => wrapPluginOptions(item, wrap))
    }
    if ('name' in value) {
      return wrap(value as Plugin)
    }
  }
  return value
}

/** 在本次构建的插件副本上收集原生 watch 注册，不改变用户插件及其 hook 元信息。 */
export function captureWatchDependencies(register: (file: string) => void): Plugin {
  const wrapped = new WeakMap<Plugin, Plugin>()
  return {
    name: 'weapp-vite:watch-dependencies',
    enforce: 'post',
    configResolved: {
      order: 'post',
      handler(config) {
        const wrap = (plugin: Plugin): Plugin => {
          const existing = wrapped.get(plugin)
          if (existing) {
            return existing
          }
          const copy = { ...plugin }
          wrapped.set(plugin, copy)
          wrapped.set(copy, copy)
          if (plugin.applyToEnvironment) {
            const apply = plugin.applyToEnvironment
            copy.applyToEnvironment = function (environment) {
              return wrapPluginOptions(apply.call(this, environment), wrap) as ReturnType<typeof apply>
            }
          }
          for (const key of hooks) {
            const hook = (plugin as unknown as Record<string, unknown>)[key]
            const handler = typeof hook === 'function' ? hook : (hook as { handler?: unknown } | undefined)?.handler
            if (typeof handler !== 'function') {
              continue
            }
            const capture = function (this: unknown, ...args: unknown[]) {
              const context = this as { addWatchFile?: (file: string) => unknown } | undefined
              if (!context?.addWatchFile) {
                return Reflect.apply(handler, this, args)
              }
              const proxy = new Proxy(context, {
                get(target, property) {
                  const value = Reflect.get(target, property, target)
                  if (property === 'addWatchFile') {
                    return (file: string) => {
                      const result = Reflect.apply(value, target, [file])
                      register(path.resolve(config.root, file))
                      return result
                    }
                  }
                  return typeof value === 'function' ? value.bind(target) : value
                },
              })
              return Reflect.apply(handler, proxy, args)
            }
            ;(copy as unknown as Record<string, unknown>)[key] = typeof hook === 'function'
              ? capture
              : { ...hook as object, handler: capture }
          }
          return copy
        }
        const plugins = config.plugins as Plugin[]
        for (let index = 0; index < plugins.length; index++) {
          plugins[index] = wrap(plugins[index]!)
        }
      },
    },
  }
}
