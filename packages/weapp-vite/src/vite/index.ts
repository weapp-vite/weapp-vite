import type { ConfigEnv, Plugin, UserConfig } from 'vite'
import type { WeappBuildSession } from './session'
import process from 'node:process'
import path from 'pathe'
import { isWeappViteHost } from '../pluginHost'
import { createSessionEnvironmentPlugin } from './environment'
import { bindHostLifecycle } from './lifecycle'
import { resolvePlugins } from './options'
import { createPluginSlots } from './slots'
import '../config'

const PLUGIN_NAME = 'weapp-vite:host'

/** 通过顶层 weapp 配置激活标准 Vite 小程序编译。 */
export function weapp(): Plugin[] {
  let session: WeappBuildSession | undefined
  let initializing = false
  let inactive = false
  let serveRequested = false
  const apply = (config: UserConfig) => !isWeappViteHost(config)
  const slots = createPluginSlots(apply)
  const coordinator: Plugin = {
    name: PLUGIN_NAME,
    enforce: 'pre',
    apply,
    config: {
      order: 'pre',
      async handler(config, env: ConfigEnv) {
        if (initializing || (session && session.state !== 'closed')) {
          throw new Error('[weapp-vite] 同一插件实例不能被多个活动宿主复用，请为每个宿主调用 weapp()。')
        }
        initializing = true
        try {
          session = undefined
          serveRequested = false
          slots.bind([])
          const configuredPlugins = await resolvePlugins(config.plugins)
          if (configuredPlugins.filter(plugin => plugin.name === PLUGIN_NAME).length !== 1) {
            throw new Error('[weapp-vite] 同一宿主只能安装一次 weapp()。')
          }
          // 使用实际宿主标识；mode=test 也可以是合法的生产构建模式。
          inactive = configuredPlugins.some(plugin => plugin.name === 'vitest:config' || plugin.name === 'vitest:project')
            || env.isPreview === true
          if (inactive) {
            return
          }
          serveRequested = env.command === 'serve'
          const options = config.weapp
          if (options?.web?.enable !== false && options?.web && options.platform !== 'web') {
            throw new Error('[weapp-vite] Web 与小程序混合宿主尚未开放；纯 Web 请设置 weapp.platform=web。')
          }
          const userPlugins = configuredPlugins.filter(plugin => plugin !== coordinator && !slots.plugins.includes(plugin))
          const hostConfig = {
            ...config,
            plugins: serveRequested ? userPlugins : [],
          }
          const { WeappBuildSession } = await import('./session')
          session = new WeappBuildSession()
          try {
            const merged = await session.prepare(hostConfig, path.resolve(config.root ?? process.cwd()), env.mode, serveRequested)
            // 主构建的用户插件已由宿主安装；子构建仍需复用它们处理各自的输入。
            session.context.configService.options.sourceConfig = { ...hostConfig, plugins: userPlugins }
            if (session.isWeb) {
              slots.bind((await resolvePlugins(merged.plugins)).filter(plugin => !configuredPlugins.includes(plugin)))
              const { plugins: _plugins, configFile: _configFile, ...normalized } = merged
              normalized.logLevel = config.logLevel
              return normalized
            }
            if (serveRequested) {
              const { prepareDevHostConfig } = await import('./dev')
              if (!session.statefulController && config.experimental?.bundledDev) {
                throw new Error('[weapp-vite] classic 开发模式暂不支持 experimental.bundledDev，请关闭此选项。')
              }
              const host = prepareDevHostConfig(session, merged, config)
              slots.bind((await resolvePlugins(host.plugins)).filter(plugin => !configuredPlugins.includes(plugin)))
              return host.config
            }
            slots.bind(await resolvePlugins(merged.plugins))
            // plugins 在工厂阶段已固定；不能通过 config 返回值动态注册。
            const { plugins: _plugins, configFile: _configFile, ...normalized } = merged
            normalized.logLevel = config.logLevel
            // 清理范围交给宿主判断；不能继承 wv 子构建的默认 emptyOutDir=false。
            if (normalized.build) {
              normalized.build.emptyOutDir = config.build?.emptyOutDir
            }
            return normalized
          }
          catch (error) {
            // 清理失败不能掩盖宿主首先收到的编译错误。
            await session.close().catch(() => {})
            throw error
          }
        }
        finally {
          initializing = false
        }
      },
    },
    async configureServer(server) {
      if (inactive || !serveRequested || !session) {
        return
      }
      const active = session
      if (active.statefulController) {
        const listen = server.listen.bind(server)
        server.listen = async (...args) => {
          const result = await listen(...args)
          await active.refreshHostControl()
          return result
        }
      }
      bindHostLifecycle(server, () => active.close())
      try {
        await active.startDev(server)
      }
      catch (error) {
        await server.close().catch(() => {})
        throw error
      }
    },
    configResolved(config) {
      if (inactive || !session) {
        return
      }
      session.context.configService.options.configFilePath = config.configFile || undefined
      session.context.configService.options.configFileDependencies = config.configFileDependencies
    },
    applyToEnvironment() {
      return session && !inactive ? createSessionEnvironmentPlugin(session, serveRequested) : false
    },
  }
  return [coordinator, ...slots.plugins]
}

// 保留宿主配置的扩展字段，同时给函数式配置中的平台联合类型提供上下文。
declare module 'vite' {
  function defineConfig<T extends (env: ConfigEnv) => UserConfig | Promise<UserConfig>>(config: T): T
}
