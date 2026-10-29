import type { InlineConfig, ViteDevServer } from 'vite'
import type { HmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import type { PreparedNpmOutput } from './npm'
import { attachDevModuleGraphHost } from '../moduleGraph/host'
import { getInitialBuildInputObservation } from '../runtime/buildPlugin/initialBuildChanges'
import { checkAppWorkersOptions } from '../runtime/buildPlugin/workers'
import { prepareClassicIdeConfig } from '../runtime/classicIdeConfig/prepare'
import { CompilerSession } from '../runtime/compilerSession'
import { findSkylineRendererFiles, resolveHmrRuntimeDecision } from '../runtime/hmrRuntime'
import { getHmrRuntimeCapabilityFallback } from '../runtime/hmrRuntimeCapabilities'
import { attachHmrRuntimeSession, createHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { createSharedBuildConfig } from '../runtime/sharedBuildConfig'
import { attachStatefulHmrHost, createStatefulHmrHostPlugins, getStatefulHmrHost } from '../runtime/statefulHmr/hostPlugins'
import { prepareStatefulClassicHandoff } from '../runtime/statefulHmr/session'
import { buildStatefulHmrSnapshot, prepareStatefulHmrSnapshot } from '../runtime/statefulHmr/snapshotBuild'
import { clearStatefulHmrSnapshot, offerStatefulHmrSnapshot, StatefulHmrSnapshotHandoff } from '../runtime/statefulHmr/snapshotHandoff'
import { syncManagedTsconfigFiles } from '../runtime/tsconfigSupport'
import { resolveRealpath } from '../utils/realpathScope'
import { prepareNpmAssets } from './npm'
import { publishOwnedNpmAssets } from './npm/ownership'

const runtimeOwners = new WeakMap<HmrRuntimeSession, WeappBuildSession>()

/** 标准插件的目标校验和依赖准备，共享底层编译会话生命周期。 */
export class WeappBuildSession extends CompilerSession {
  private dependencyBuild?: Promise<PreparedNpmOutput>
  private validating?: Promise<void>
  private hostClosing?: Promise<void>
  private terminalClosing?: Promise<void>
  isWeb = false
  statefulController?: ReturnType<typeof createStatefulHmrHostPlugins>

  constructor(readonly hmrRuntimeSession = createHmrRuntimeSession()) {
    super()
    runtimeOwners.set(hmrRuntimeSession, this)
    this.onClose(attachHmrRuntimeSession(this.context, hmrRuntimeSession))
    this.onClose(() => clearStatefulHmrSnapshot(this.context))
  }

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
    await prepareClassicIdeConfig(this.context)
    if (isDev && this.hmrRuntimeSession.resolve(resolveHmrRuntimeDecision({
      platform: service.platform,
      configured: service.weappViteConfig.hmr?.runtime,
      compileHotReLoad: service.projectPrivateConfig.setting?.compileHotReLoad,
    })).runtime === 'stateful-experimental') {
      if (service.platform !== 'weapp') {
        this.hmrRuntimeSession.requestClassic({ code: 'platform', message: '当前小程序平台不支持状态保持热更新。' })
      }
      else {
        await this.run(async () => {
          try {
            // 在 Vite 创建 bundled-development 宿主前确定首构能力；产物仍为 write:false。
            // 完整输入版本在编译前捕获，只有编译后及正式接管时均未漂移才复用。
            const snapshot = prepareStatefulHmrSnapshot(await buildStatefulHmrSnapshot(service.loadOptions, undefined, this.context, undefined, []))
            const skylineFiles = findSkylineRendererFiles(snapshot.output)
            if (skylineFiles.length) {
              this.hmrRuntimeSession.requestClassic({ code: 'skyline', message: '微信 Skyline 暂不支持状态保持 HMR。', files: skylineFiles })
              return
            }
            await offerStatefulHmrSnapshot(this.context, new StatefulHmrSnapshotHandoff(snapshot, snapshot.inputs))
            this.statefulController = createStatefulHmrHostPlugins(this.context)
          }
          catch (error) {
            const fallback = getHmrRuntimeCapabilityFallback(error)
            if (!fallback) {
              throw error
            }
            this.hmrRuntimeSession.requestClassic(fallback)
          }
        })
      }
    }
    const merged = this.context.configService.merge(undefined, createSharedBuildConfig(this.context.configService, this.context.scanService))
    return merged
  }

  /** 只关闭本代资源；宿主负责在原生 watcher 和服务器均退出后恢复 IDE 设置。 */
  closeHostGeneration(reason: 'restart' | 'close'): Promise<void> {
    if (!this.hostClosing) {
      if (reason === 'restart' && this.hmrRuntimeSession.fallback) {
        prepareStatefulClassicHandoff(this.context)
      }
      this.hostClosing = super.close()
    }
    return this.hostClosing
  }

  /** 无宿主的构建或首次配置失败可直接释放，已绑定宿主必须走其关闭门禁。 */
  override close(reason: 'restart' | 'close' = 'close'): Promise<void> {
    return reason === 'restart'
      ? this.closeHostGeneration(reason)
      : this.terminalClosing ??= this.closeHostGeneration(reason).then(() => this.releaseClassicIdeConfig())
  }

  /** 只释放仍未被替换宿主接管的 owner，初始化失败和遗弃交接使用同一关闭门禁。 */
  async releaseClassicIdeConfig(): Promise<void> {
    await super.close()
    if (runtimeOwners.get(this.hmrRuntimeSession) === this) {
      this.hmrRuntimeSession.sourcePublication.close()
      await this.hmrRuntimeSession.classicIdeConfig.close()
    }
  }

  /** 原生宿主链已完全退出后，连同尚未绑定宿主的失败替换代一起释放。 */
  async releaseHostClassicIdeConfig(): Promise<void> {
    const current = runtimeOwners.get(this.hmrRuntimeSession)
    await current?.closeHostGeneration('close')
    this.hmrRuntimeSession.sourcePublication.close()
    await this.hmrRuntimeSession.classicIdeConfig.close()
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
        const app = await this.context.scanService.loadAppEntry()
        checkAppWorkersOptions('app', this.context.configService, app)
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
    }).catch((error) => {
      getInitialBuildInputObservation(this.context.configService)?.close()
      throw error
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
        if (this.statefulController && this.hmrRuntimeSession.phase === 'switching') {
          return
        }
        reportedReady = true
        if (!this.statefulController) {
          this.hmrRuntimeSession.markClassic()
        }
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
      return Promise.resolve({ assets: [], external: new Map(), watchFiles: [] })
    }
    if (this.state !== 'building') {
      throw new Error('[weapp-vite] 依赖构建需要活动的构建会话。')
    }
    return this.dependencyBuild ??= this.run(() => prepareNpmAssets(this.context))
  }

  async publishDependencies() {
    if (!this.dependencyBuild) {
      return
    }
    const { external } = await this.dependencyBuild
    const { cwd, outDir } = this.context.configService
    await this.run(() => publishOwnedNpmAssets(cwd, outDir, external))
  }
}
