import type { ConfigEnv, Plugin, UserConfig } from 'vite'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import type { HostLifecycle } from './lifecycle'
import type { WeappBuildSession } from './session'
import process from 'node:process'
import { WEAPP_VITE_HMR_RUNTIME_SESSION_HANDOFF_KEY } from '@weapp-core/constants'
import path from 'pathe'
import { isWeappViteHost } from '../pluginHost'
import { bindClassicFallback, rethrowAfterHostCleanup } from './classicFallback'
import { createSessionEnvironmentPlugin } from './environment'
import { bindHostLifecycle, setHostRestartData, takeHostConfigRestartData, takeHostLifecycle } from './lifecycle'
import { resolvePlugins } from './options'
import { createPluginSlots } from './slots'
import '../config'

const PLUGIN_NAME = 'weapp-vite:host'
const hmrRuntimeSessionKey = Symbol.for(WEAPP_VITE_HMR_RUNTIME_SESSION_HANDOFF_KEY)

/** 通过顶层 weapp 配置激活标准 Vite 小程序编译。 */
export function weapp(): Plugin[] {
  let session: WeappBuildSession | undefined
  let initializing = false
  let inactive = false
  let serveRequested = false
  let inheritedLifecycle: HostLifecycle | undefined
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
          // Vite 的配置合并不保留 symbol；先消费仅属于重启副本的载体，避免泄露给用户插件。
          inheritedLifecycle = takeHostLifecycle(config)
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
          const inheritedRuntime = takeHostConfigRestartData<HmrRuntimeSession>(inheritedLifecycle, hmrRuntimeSessionKey)
          session = new WeappBuildSession(inheritedRuntime)
          try {
            const fallbackBeforePrepare = session.hmrRuntimeSession.fallback
            let merged = await session.prepare(hostConfig, path.resolve(config.root ?? process.cwd()), env.mode, serveRequested)
            if (session.hmrRuntimeSession.phase === 'switching' && session.hmrRuntimeSession.fallback !== fallbackBeforePrepare) {
              const runtime = session.hmrRuntimeSession
              await session.close('restart')
              session = new WeappBuildSession(runtime)
              merged = await session.prepare(hostConfig, path.resolve(config.root ?? process.cwd()), env.mode, serveRequested)
            }
            // 主构建的用户插件已由宿主安装；子构建仍需复用它们处理各自的输入。
            session.context.configService.options.sourceConfig = { ...hostConfig, root: session.context.configService.cwd, plugins: userPlugins }
            if (session.isWeb) {
              slots.bind((await resolvePlugins(merged.plugins)).filter(plugin => !configuredPlugins.includes(plugin)))
              const { plugins: _plugins, configFile: _configFile, ...normalized } = merged
              normalized.logLevel = config.logLevel
              return normalized
            }
            if (serveRequested) {
              const { prepareDevHostConfig } = await import('./dev')
              if (!session.statefulController && config.experimental?.bundledDev && !session.hmrRuntimeSession.fallback) {
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
            // 继承链的原宿主尚在 nativeRestart 中，配置失败不能提前恢复命令级 IDE 设置。
            return await rethrowAfterHostCleanup(error, () => session!.close(inheritedLifecycle ? 'restart' : 'close'))
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
      bindHostLifecycle(server, reason => active.closeHostGeneration(reason), inheritedLifecycle, () => active.hmrRuntimeSession.phase === 'switching', () => active.releaseHostClassicIdeConfig())
      inheritedLifecycle = undefined
      try {
        // 每代都转交同一个命令级决策；普通配置重启和新的插件工厂也不能重新开启 stateful。
        await setHostRestartData(server, hmrRuntimeSessionKey, active.hmrRuntimeSession)
        await active.startDev(server)
      }
      catch (error) {
        return await rethrowAfterHostCleanup(error, () => server.close())
      }
      // 后置钩子在所有 configureServer 完成后安装处理器，避免初始化中的请求关闭自身。
      return () => {
        if (!active.isClosing) {
          active.onClose(bindClassicFallback(server, active.hmrRuntimeSession))
        }
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
