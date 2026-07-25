import { emitRuntimeWarning } from './warning'

type HostGlobalsTarget = Record<PropertyKey, any>

const IDENTITY_CONSTRUCTORS = ['App', 'Page', 'Component'] as const
const COMPILE_TIME_MACROS = [
  'defineAppJson',
  'defineComponentJson',
  'definePageJson',
  'definePageMeta',
  'defineSitemapJson',
  'defineThemeJson',
] as const

const PLUGIN_METHOD_RE = /^(?:add|can|choose|clear|close|create|delete|get|has|hide|is|load|navigate|off|on|open|remove|request|save|say|set|show|start|stop|update|upload)/i

function createUnsupportedPlugin() {
  return new Proxy(Object.create(null) as Record<PropertyKey, unknown>, {
    get(_target, property) {
      if (property === 'then') {
        return undefined
      }
      if (typeof property === 'string' && PLUGIN_METHOD_RE.test(property)) {
        return () => undefined
      }
      return undefined
    },
  })
}

/**
 * 安装第三方库在模块求值阶段可能读取的小程序宿主全局。
 */
export function installWebHostGlobals(target: HostGlobalsTarget = globalThis): void {
  for (const name of IDENTITY_CONSTRUCTORS) {
    if (typeof target[name] !== 'function') {
      target[name] = (options: Record<string, any>) => options
    }
  }
  for (const name of COMPILE_TIME_MACROS) {
    if (typeof target[name] !== 'function') {
      target[name] = (options: unknown) => options
    }
  }
  if (typeof target.Behavior !== 'function') {
    target.Behavior = (options: Record<string, any>) => options
  }
  if (typeof target.requirePlugin !== 'function') {
    target.requirePlugin = (pluginName: string) => {
      emitRuntimeWarning(`[@weapp-vite/web] 插件 ${JSON.stringify(pluginName)} 暂无 Web 运行时实现，当前使用空代理降级。`, {
        key: `unsupported-plugin:${pluginName}`,
      })
      return createUnsupportedPlugin()
    }
  }
}
