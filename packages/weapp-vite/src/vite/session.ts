import type { EmittedAsset } from 'rolldown'
import type { InlineConfig, ViteDevServer } from 'vite'
import { attachDevModuleGraphHost } from '../moduleGraph/host'
import { CompilerSession } from '../runtime/compilerSession'
import { resolveHmrRuntimeDecision } from '../runtime/hmrRuntime'
import { createSharedBuildConfig } from '../runtime/sharedBuildConfig'
import { attachStatefulHmrHost, createStatefulHmrHostPlugins, getStatefulHmrHost } from '../runtime/statefulHmr/hostPlugins'
import { syncManagedTsconfigFiles } from '../runtime/tsconfigSupport'
import { prepareNpmAssets } from './npm'

/** 标准插件的目标校验和依赖准备，共享底层编译会话生命周期。 */
export class WeappBuildSession extends CompilerSession {
  private dependencyBuild?: Promise<EmittedAsset[]>
  private validating?: Promise<void>
  statefulController?: ReturnType<typeof createStatefulHmrHostPlugins>

  async prepare(config: InlineConfig, cwd: string, mode: string, isDev = false): Promise<InlineConfig> {
    await this.initialize({
      cwd,
      mode,
      isDev,
      emitDefaultAutoImportOutputs: false,
      hostConfig: { config },
      syncSupportFiles: false,
      preloadAppEntry: false,
    })
    const service = this.context.configService
    if (isDev && resolveHmrRuntimeDecision({
      platform: service.platform,
      configured: service.weappViteConfig.hmr?.runtime,
      compileHotReLoad: service.projectPrivateConfig.setting?.compileHotReLoad,
    }).runtime === 'stateful-experimental') {
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
      const app = await this.context.scanService.loadAppEntry()
      if (app.json.workers) {
        throw new Error('[weapp-vite] 标准插件 alpha 尚不支持 worker，请使用 wv build。')
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
    if (this.state !== 'building') {
      throw new Error('[weapp-vite] 依赖构建需要活动的构建会话。')
    }
    return this.dependencyBuild ??= this.run(() => prepareNpmAssets(this.context))
  }
}
