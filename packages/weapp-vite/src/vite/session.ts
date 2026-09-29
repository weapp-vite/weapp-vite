import type { EmittedAsset } from 'rolldown'
import type { InlineConfig } from 'vite'
import type { CompilerContext } from '../context'
import { createCompilerContextInstance } from '../context/createCompilerContextInstance'
import { isReactEnabled } from '../plugins/react'
import { createSharedBuildConfig } from '../runtime/sharedBuildConfig'
import { retainWatcherService } from '../runtime/watcherPlugin'
import { prepareNpmAssets } from './npm'

export type BuildSessionState = 'created' | 'preparing' | 'ready' | 'building' | 'watching' | 'closing' | 'closed'

/** 独立宿主会话，不注册或切换进程级活动编译上下文。 */
export class WeappBuildSession {
  state: BuildSessionState = 'created'
  readonly context: CompilerContext = createCompilerContextInstance()
  private readonly release = retainWatcherService(this.context.watcherService)
  private closing?: Promise<void>
  private dependencyBuild?: Promise<EmittedAsset[]>
  private preparing?: Promise<InlineConfig>
  private validating?: Promise<void>

  prepare(config: InlineConfig, cwd: string, mode: string): Promise<InlineConfig> {
    if (this.state !== 'created') {
      throw new Error(`[weapp-vite] 无法从 ${this.state} 状态初始化会话。`)
    }
    this.state = 'preparing'
    this.preparing = (async () => {
      await this.context.configService.load({
        cwd,
        mode,
        isDev: false,
        emitDefaultAutoImportOutputs: false,
        hostConfig: { config },
      })
      if (isReactEnabled(this.context)) {
        throw new Error('[weapp-vite] 标准插件 alpha 尚不支持 React，请使用 wv build。')
      }
      const service = this.context.configService
      if (service.weappViteConfig.npm?.enable && (service.weappViteConfig.npm.buildOptions || service.projectConfig.setting?.packNpmManually)) {
        throw new Error('[weapp-vite] 标准插件 alpha 尚不支持自定义 npm 构建回调或手工 npm 输出映射，请使用 wv build。')
      }
      const merged = this.context.configService.merge(undefined, createSharedBuildConfig(this.context.configService, this.context.scanService))
      if (this.state === 'preparing') {
        this.state = 'ready'
      }
      return merged
    })()
    return this.preparing
  }

  validateEntries(): Promise<void> {
    if (this.state !== 'ready') {
      return Promise.reject(new Error(`[weapp-vite] 无法从 ${this.state} 状态开始构建。`))
    }
    return this.validating ??= (async () => {
      const app = await this.context.scanService.loadAppEntry()
      if (app.json.workers || (app.json.subPackages ?? []).some(entry => entry.independent)) {
        throw new Error('[weapp-vite] 标准插件 alpha 尚不支持 worker 或独立分包，请使用 wv build。')
      }
      if (this.state === 'closing' || this.state === 'closed') {
        throw new Error('[weapp-vite] 构建会话已关闭。')
      }
      this.state = 'building'
    })()
  }

  buildDependencies() {
    if (this.state !== 'building') {
      throw new Error('[weapp-vite] 依赖构建需要活动的构建会话。')
    }
    return this.dependencyBuild ??= prepareNpmAssets(this.context)
  }

  close(): Promise<void> {
    return this.closing ??= (async () => {
      this.state = 'closing'
      await this.preparing?.catch(() => {})
      await this.validating?.catch(() => {})
      await this.dependencyBuild?.catch(() => {})
      try {
        await this.release()
      }
      finally {
        this.state = 'closed'
      }
    })()
  }
}
