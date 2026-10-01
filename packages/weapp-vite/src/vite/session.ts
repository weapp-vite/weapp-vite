import type { EmittedAsset } from 'rolldown'
import type { InlineConfig, ViteDevServer } from 'vite'
import { attachDevModuleGraphHost } from '../moduleGraph/host'
import { checkWorkersOptions } from '../runtime/buildPlugin/workers'
import { CompilerSession } from '../runtime/compilerSession'
import { resolveHmrRuntimeDecision } from '../runtime/hmrRuntime'
import { createSharedBuildConfig } from '../runtime/sharedBuildConfig'
import { attachStatefulHmrHost, createStatefulHmrHostPlugins, getStatefulHmrHost } from '../runtime/statefulHmr/hostPlugins'
import { syncManagedTsconfigFiles } from '../runtime/tsconfigSupport'
import { resolveRealpath } from '../utils/realpathScope'
import { prepareNpmAssets } from './npm'

/** 标准插件的目标校验和依赖准备，共享底层编译会话生命周期。 */
export class WeappBuildSession extends CompilerSession {
  private dependencyBuild?: Promise<EmittedAsset[]>
  private validating?: Promise<void>
  isWeb = false
  statefulController?: ReturnType<typeof createStatefulHmrHostPlugins>

  async prepare(config: InlineConfig, cwd: string, mode: string, isDev = false): Promise<InlineConfig> {
    // 与 Vite 的根目录解析一致，扫描和侧车监听不能继续持有另一条目录身份。
    if (!config.resolve?.preserveSymlinks) {
      try {
        cwd = resolveRealpath(cwd)
      }
      catch {
        // 与宿主一致：不存在或不可解析的路径由后续配置/构建给出原有诊断。
      }
    }
    this.isWeb = config.weapp?.platform === 'web'
    await this.initialize({
      cwd,
      mode,
      isDev,
      emitDefaultAutoImportOutputs: false,
      hostConfig: { config: { ...config, root: cwd } },
      cliPlatform: this.isWeb ? 'web' : undefined,
      syncSupportFiles: false,
      preloadAppEntry: false,
    })
    const service = this.context.configService
    if (this.isWeb) {
      const merged = service.mergeWeb()
      if (!merged) {
        throw new Error('[weapp-vite] Web 目标不能禁用 weapp.web。')
      }
      return merged
    }
    if (isDev && resolveHmrRuntimeDecision({
      platform: service.platform,
      configured: service.weappViteConfig.hmr?.runtime,
      compileHotReLoad: service.projectPrivateConfig.setting?.compileHotReLoad,
    }).runtime === 'stateful-experimental') {
      if (service.platform !== 'weapp') {
        throw new Error('[weapp-vite] stateful-experimental 仅支持微信；其他平台请配置 hmr.runtime=classic。')
      }
      this.statefulController = createStatefulHmrHostPlugins(this.context)
    }
    if (service.weappViteConfig.npm?.enable && (service.weappViteConfig.npm.buildOptions || service.projectConfig.setting?.packNpmManually)) {
      throw new Error('[weapp-vite] 标准插件 alpha 尚不支持自定义 npm 构建回调或手工 npm 输出映射，请使用 wv build。')
    }
    const merged = this.context.configService.merge(undefined, createSharedBuildConfig(this.context.configService, this.context.scanService))
    return merged
  }

  validateEntries(): Promise<void> {
    if (this.validating && !this.isClosing) {
      return this.validating
    }
    if (this.state !== 'ready' && this.state !== 'building') {
      return Promise.reject(new Error(`[weapp-vite] 无法从 ${this.state} 状态开始构建。`))
    }
    this.dependencyBuild = undefined
    return this.validating = this.run(async () => {
      if (!this.isWeb && !this.context.configService.weappLibConfig?.enabled) {
        await this.context.scanService.loadAppEntry()
        checkWorkersOptions('app', this.context.configService, this.context.scanService)
      }
      if (this.isClosing) {
        throw new Error('[weapp-vite] 构建会话已关闭。')
      }
      // 仅在真实构建开始后生成支持文件，保证干净安装可构建且配置检查无落盘副作用。
      await syncManagedTsconfigFiles(this.context)
      if (this.isClosing) {
        throw new Error('[weapp-vite] 构建会话已关闭。')
      }
      this.state = 'building'
    }).finally(() => {
      this.validating = undefined
    })
  }

  async startDev(server: ViteDevServer) {
    if (this.isWeb) {
      await this.run(() => syncManagedTsconfigFiles(this.context))
      this.state = 'watching'
      return
    }
    let started = false
    let successful = false
    let reportedReady = false
    const reportReady = () => {
      if (started && successful && !reportedReady && !this.isClosing) {
        reportedReady = true
        server.config.logger.info(`[weapp-vite] 小程序开发产物已就绪 (${this.statefulController ? 'stateful-experimental' : 'classic'})`)
      }
    }
    if (this.statefulController) {
      this.onClose(attachStatefulHmrHost(this.context, { server, controller: this.statefulController }))
    }
    this.onClose(attachDevModuleGraphHost(this.context, server, (result) => {
      successful = result
      reportReady()
    }))
    this.onClose(() => this.context.watcherService.closeAll())
    await this.validateEntries()
    await this.run(() => this.context.buildService.build({}))
    if (!this.isClosing) {
      this.state = 'watching'
      if (this.statefulController) {
        successful = true
      }
      started = true
      reportReady()
    }
  }

  async refreshHostControl() {
    await getStatefulHmrHost(this.context)?.refreshControl?.()
  }

  buildDependencies() {
    if (this.isWeb) {
      return Promise.resolve([])
    }
    if (this.state !== 'building') {
      throw new Error('[weapp-vite] 依赖构建需要活动的构建会话。')
    }
    return this.dependencyBuild ??= this.run(() => prepareNpmAssets(this.context))
  }
}
