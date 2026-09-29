import type { Plugin } from 'vite'

// 顺序与内部编译阶段一致；可选能力保留空槽，配置阶段只绑定实现，不注册新插件。
const descriptors: Array<[string, Plugin['enforce']?]> = [
  ...['config', 'watcher', 'wxml', 'json', 'scan', 'auto-routes', 'auto-import', 'npm', 'build', 'web']
    .map(name => [`weapp-runtime:${name}-service`] as [string]),
  ['weapp-vite:context', 'pre'],
  ['weapp-vite:runtime-provider:native-miniprogram', 'pre'],
  ['weapp-vite:runtime-provider:wevu-miniprogram', 'pre'],
  ['weapp-vite:preflight', 'pre'],
  ['weapp-vite:set-env', 'pre'],
  ['weapp-vite:uni-app-compatibility', 'pre'],
  ['weapp-vite:vue:resolver'],
  ['weapp-vite:vue:transform'],
  ['weapp-vite:vue:watch'],
  ['weapp-vite:wevu:page-features', 'pre'],
  ['weapp-vite:asset', 'post'],
  ['weapp-vite:auto-routes', 'pre'],
  ['weapp-vite:auto-import', 'pre'],
  ['weapp-vite:i18n', 'pre'],
  ['weapp-vite:pre:native-style', 'pre'],
  ['weapp-vite:pre', 'pre'],
  ['weapp-vite:post', 'post'],
  ['weapp-vite:wxs', 'post'],
  ['weapp-vite:css-sidecar-source'],
  ['weapp-vite:oxc-runtime-helpers', 'pre'],
  ['vite-tsconfig-paths', 'pre'],
  ['weapp-vite:compiler:source', 'pre'],
  ['weapp-vite:tailwindcss', 'pre'],
  ['weapp-vite:css', 'pre'],
  ['weapp-vite:output-finalizer', 'post'],
  ['weapp-vite:tailwindcss:output', 'post'],
  ['weapp-vite:compiler:output', 'post'],
  ['weapp-vite:output-publication', 'post'],
]

/** 延迟绑定保留钩子对象、过滤器与原始 this，转换链及 sourcemap 仍由 Vite 调度。 */
export function createPluginSlots(apply: NonNullable<Plugin['apply']>) {
  const delegates = new Map<string, Plugin>()
  const plugins = descriptors.map(([name, enforce]): Plugin => {
    const slot: Plugin = {
      name: name === 'vite-tsconfig-paths' ? 'weapp-vite:tsconfig-paths-slot' : name,
      enforce,
      apply,
      config(config, env) {
        const hook = delegates.get(name)?.config
        if (!hook) {
          return
        }
        const handler = typeof hook === 'function' ? hook : hook.handler
        return handler.call(this, config, env)
      },
    }
    return slot
  })
  const originals = plugins.map(plugin => ({ ...plugin }))
  return {
    plugins,
    bind(implementations: Plugin[]) {
      delegates.clear()
      for (const [index, plugin] of plugins.entries()) {
        for (const key of Reflect.ownKeys(plugin)) {
          Reflect.deleteProperty(plugin, key)
        }
        Object.assign(plugin, originals[index])
      }
      for (const implementation of implementations) {
        const slot = descriptors.find(([name]) => name === implementation.name)
        if (!slot || slot[1] !== implementation.enforce || delegates.has(implementation.name)) {
          throw new Error(`[weapp-vite] 插件槽不匹配：${implementation.name}。请检查宿主插件支持矩阵。`)
        }
        delegates.set(implementation.name, implementation)
        const target = plugins[descriptors.indexOf(slot)]!
        const config = target.config
        Object.assign(target, implementation, { config, apply })
      }
    },
  }
}
