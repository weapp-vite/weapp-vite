import type { EmittedAsset } from 'rolldown'
import type { InlineConfig, ViteDevServer } from 'vite'
import { attachDevModuleGraphHost } from '../moduleGraph/host'
import { isReactEnabled } from '../plugins/react'
import { CompilerSession } from '../runtime/compilerSession'
import { resolveHmrRuntimeDecision } from '../runtime/hmrRuntime'
import { createSharedBuildConfig } from '../runtime/sharedBuildConfig'
import { syncManagedTsconfigFiles } from '../runtime/tsconfigSupport'
import { prepareNpmAssets } from './npm'

/** 标准插件的目标校验和依赖准备，共享底层编译会话生命周期。 */
export class WeappBuildSession extends CompilerSession {
  private dependencyBuild?: Promise<EmittedAsset[]>
  private validating?: Promise<void>

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
    if (isReactEnabled(this.context)) {
      throw new Error('[weapp-vite] 标准插件 alpha 尚不支持 React，请使用 wv build。')
    }
    const service = this.context.configService
    if (isDev && resolveHmrRuntimeDecision({
      platform: service.platform,
      configured: service.weappViteConfig.hmr?.runtime,
      compileHotReLoad: service.projectPrivateConfig.setting?.compileHotReLoad,
    }).runtime !== 'classic') {
      throw new Error('[weapp-vite] 标准插件开发模式暂仅支持 classic，请显式设置 weapp.hmr.runtime 为 classic。')
    }
    if (service.weappViteConfig.npm?.enable && (service.weappViteConfig.npm.buildOptions || service.projectConfig.setting?.packNpmManually)) {
      throw new Error('[weapp-vite] 标准插件 alpha 尚不支持自定义 npm 构建回调或手工 npm 输出映射，请使用 wv build。')
    }
    const merged = this.context.configService.merge(undefined, createSharedBuildConfig(this.context.configService, this.context.scanService))
    return merged
  }

  validateEntries(): Promise<void> {
    if (this.state !== 'ready') {
      return Promise.reject(new Error(`[weapp-vite] 无法从 ${this.state} 状态开始构建。`))
    }
    return this.validating ??= this.run(async () => {
      const app = await this.context.scanService.loadAppEntry()
      if (app.json.workers || (app.json.subPackages ?? []).some(entry => entry.independent)) {
        throw new Error('[weapp-vite] 标准插件 alpha 尚不支持 worker 或独立分包，请使用 wv build。')
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
    })
  }

  async startDev(server: ViteDevServer) {
    let started = false
    let successful = false
    let reportedReady = false
    const reportReady = () => {
      if (started && successful && !reportedReady && !this.isClosing) {
        reportedReady = true
        server.config.logger.info('[weapp-vite] 小程序开发产物已就绪 (classic)')
      }
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
      started = true
      reportReady()
    }
  }

  buildDependencies() {
    if (this.state !== 'building') {
      throw new Error('[weapp-vite] 依赖构建需要活动的构建会话。')
    }
    return this.dependencyBuild ??= this.run(() => prepareNpmAssets(this.context))
  }
}
