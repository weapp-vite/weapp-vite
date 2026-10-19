import type { InlineConfig } from 'vite'
import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { LoadConfigOptions } from '../config/types'
import { readFile } from 'node:fs/promises'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { build } from 'vite'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { parseSidecarSourceMetadata } from '../../moduleGraph/protocol'
import { createPublicAssetSourcePlan } from '../../plugins/asset/publicSources'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { bindTailwindSnapshotGeneration, validateTailwindSnapshotGeneration } from '../../plugins/tailwindcss/generation'
import { validateImportedTailwindSnapshot } from '../../plugins/tailwindcss/importedPreparation'
import { getTailwindStyleOwners } from '../../plugins/tailwindcss/styleOwners'
import { invalidateFileCache } from '../../plugins/utils/cache'
import { configSuffixes } from '../../plugins/utils/invalidateEntry/shared'
import { captureCompilerNativeScriptInputs, readCompilerInput, setCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { withRealpathScope } from '../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { captureWatchDependencies } from '../../utils/watchDependencies'
import { getWxmlWatchFiles, shareWxmlDependencies } from '../../wxml/processing/dependencies'
import { getWorkerSources } from '../buildPlugin/workerPlan'
import { resolveScanAppBasename } from '../scanPlugin/service'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { resolveComponentPageGlobalStyleRoutes } from './componentPageStyles'
import { createStatefulHmrSidecarPlugin } from './sidecarPlugin'
import { createSnapshotAssetInputs } from './snapshotAssetInputs'
import { captureSnapshotInputs, coversSnapshotInputs, validateSnapshotInputs } from './snapshotInputs'
import { createSnapshotNativeScriptDriftProbe } from './snapshotNativeScripts'

/** 快照独立编译；初始化到构建收尾均不写支持文件，由活动 DevEngine 统一维护。 */
export async function buildStatefulHmrSnapshot(
  loadOptions: LoadConfigOptions,
  configure: (options: InlineConfig) => InlineConfig = options => options,
  owner?: Pick<MutableCompilerContext, 'runtimeState' | 'configService'>,
  sources?: ReadonlyMap<string, string | null>,
  handoffInputFiles?: readonly string[],
) {
  const ctx = createCompilerContextInstance()
  const assetInputs = createSnapshotAssetInputs(sources)
  let releaseGeneration = () => {}
  const ownerConfig = owner?.configService
  const inheritedVueEntryIds = owner && ownerConfig
    ? (await Promise.all(Array.from(owner.runtimeState.build.hmr.resolvedEntryMap.keys())
        .filter(id => /\.(?:vue|jsx|tsx)$/.test(id))
        .filter(id => owner.runtimeState.build.hmr.entriesMap.get(
          ownerConfig.relativeAbsoluteSrcRoot(removeExtensionDeep(id)),
        )?.type === 'component')
        .map(async id => await fs.pathExists(id) ? normalizeFsResolvedId(id) : undefined))).filter((id): id is string => Boolean(id))
    : []
  if (owner) {
    shareWxmlDependencies(owner, ctx)
    // 入口快照在独立上下文中重建，但组件解析注册表属于活动 DevEngine。
    // 复用同一注册表，确保仅更新共享模块时仍能生成原有组件 logical entry。
    ctx.runtimeState.build.hmr.externalComponentEntryMap = owner.runtimeState.build.hmr.externalComponentEntryMap
  }
  return await ctx.autoImportService.runWithoutOutputWrites(async () => {
    ctx.currentBuildTarget = 'app'
    await ctx.configService.load(ownerConfig?.options.sourceConfig
      ? {
          ...loadOptions,
          hostConfig: {
            config: ownerConfig.options.sourceConfig,
            path: ownerConfig.configFilePath,
            dependencies: ownerConfig.configFileDependencies,
          },
        }
      : loadOptions)
    if (sources) {
      setCompilerSourceSnapshot(ctx.configService, sources)
    }
    releaseGeneration = bindTailwindSnapshotGeneration(ctx as CompilerContext, sources)
    const inputFiles = new Set<string>()
    const consumedFiles = new Set<string>()
    const config = ctx.configService
    const publicDir = config.options.sourceConfig?.publicDir
    // 资产编译前记录版本，涵盖新目录和此前已发现的外部依赖。缺失信息只禁用复用。
    const inputs = handoffInputFiles && !sources
      ? await captureSnapshotInputs({
          roots: [config.absoluteSrcRoot, ...(publicDir === false ? [] : [path.resolve(config.cwd, typeof publicDir === 'string' ? publicDir : 'public')])],
          files: [...handoffInputFiles, ...config.configFileDependencies, ...[config.configFilePath, config.projectConfigPath].filter((file): file is string => Boolean(file))].filter(file => path.isAbsolute(file)),
          excluded: [config.outDir, path.join(config.cwd, '.weapp-vite')].map(file => normalizeFsResolvedId(file)),
          // IDE 私有监听租约会在旧会话关闭时恢复；只有插件明确声明时才属于编译输入。
          skipPaths: [path.join(config.cwd, 'node_modules'), path.join(config.cwd, '.git'), ...(config.projectPrivateConfigPath ? [config.projectPrivateConfigPath] : [])].map(file => normalizeFsResolvedId(file)),
        }).catch(() => undefined)
      : undefined
    // 快照使用独立上下文，但仍共享编译器的文件缓存；拓扑批次可能只收到
    // 页面目录的 create/delete，不能依赖 app.json 自身也出现在同一批事件中。
    // 每次快照读取前失效所有受支持的 app 配置后缀，确保 pages/workers 等
    // 元数据与磁盘上的最新内容一致。
    const appBasename = normalizeFsResolvedId(resolveScanAppBasename(ctx.configService.absoluteSrcRoot))
    for (const suffix of configSuffixes) {
      invalidateFileCache(`${appBasename}${suffix}`)
    }
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    let globalStyleRoutes: string[] = []
    let publicAssets: ReturnType<typeof createPublicAssetSourcePlan> | undefined
    const baseOptions = ctx.configService.merge(
      undefined,
      createSharedBuildConfig(ctx.configService, ctx.scanService),
    )
    baseOptions.plugins = [...(baseOptions.plugins ?? []), {
      name: 'weapp-vite:stateful-hmr-page-style-metadata',
      enforce: 'post',
      configResolved(config) {
        publicAssets = createPublicAssetSourcePlan({ publicDir: config.publicDir, copyPublicDir: config.build.copyPublicDir }, ctx.configService.outDir)
      },
      buildEnd() {
        // Rolldown 没有 getWatchFiles 插件接口；只收集框架实际维护的依赖声明。
        for (const file of this.getModuleIds()) {
          const source = file.replace(/\?.*$/, '')
          inputFiles.add(source)
          consumedFiles.add(source)
          for (const dependency of ctx.moduleGraphService.getTransformDependencies(file)) {
            inputFiles.add(dependency)
          }
        }
      },
      async generateBundle(_options, bundle) {
        // 资产快照随后会删除 JS chunk，必须在完整产物阶段确认页面注册与样式边界。
        globalStyleRoutes = resolveComponentPageGlobalStyleRoutes(Object.values(bundle), ctx.runtimeState.build.hmr.componentPageStyleOptions)
        // write:false 不运行 Vite 的 public 复制阶段；把未被编译产物覆盖的文件交给原生资产写出。
        for (const file of await publicAssets?.scan() ?? []) {
          inputFiles.add(file)
          const fileName = publicAssets!.outputName(file)
          if (!bundle[fileName]) {
            this.emitFile({ type: 'asset', fileName, source: await readFile(file) })
          }
        }
      },
    }]
    const options = configure(baseOptions)
    options.plugins = [...(options.plugins ?? []), captureWatchDependencies(file => inputFiles.add(file))]
    options.build = { ...options.build, watch: undefined, write: false }
    if (sources) {
      let assetsInclude: ((id: string) => boolean) | undefined
      options.plugins = [{
        name: 'weapp-vite:snapshot-input',
        enforce: 'pre',
        configResolved(config) {
          assetsInclude = config.assetsInclude
          assetInputs.configure(assetsInclude)
        },
        load: {
          order: 'pre',
          handler(id) {
            if (id.startsWith('\0')) {
              return null
            }
            if (id.includes('?')) {
              // 内部侧车由固定源码 loader 消费；普通 raw/url 仍由 Vite 读取并核验字节。
              if (!parseSidecarSourceMetadata(id) && /[?&](?:raw|url)(?:&|$)/.test(id)) {
                assetInputs.capture(id.slice(0, id.indexOf('?')), true)
              }
              return null
            }
            if (assetsInclude?.(id)) {
              assetInputs.capture(id)
              return null
            }
            // 入口归属与固定源码身份共用本次同步解析，下一次加载重新读取真实路径。
            return withRealpathScope(() => {
              const sourceId = normalizeFsResolvedId(id)
              // Vue 和 app 已有固定源码 loader，不需要再查询原生入口的真实路径归属。
              if (sourceId.endsWith('.vue')
                || (ctx.scanService.appEntry?.path && normalizeFsResolvedId(ctx.scanService.appEntry.path) === sourceId)) {
                return null
              }
              const sourceKey = compilerSourceId(id)
              // 声明可能指向目录；已解析入口以真实脚本路径持有原生加载及伴随资产。
              if (ctx.runtimeState.build.hmr.resolvedEntryMap.has(sourceKey)) {
                return null
              }
              const source = sources.get(sourceKey)
              if (source === null) {
                throw new Error(`Source removed from snapshot: ${id}`)
              }
              return source === undefined ? null : { code: source }
            })
          },
        },
      }, createStatefulHmrSidecarPlugin(id => readCompilerInput(ctx.configService, id)), ...(options.plugins ?? [])]
    }
    const { value: output, versions: nativeScriptVersions } = await captureCompilerNativeScriptInputs(ctx.configService, () => build(options), id =>
      ctx.runtimeState.build.hmr.entriesMap.has(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)))
      || (ctx.scanService.appEntry?.path !== undefined && compilerSourceId(ctx.scanService.appEntry.path) === id)).catch((error: unknown) => {
      throw assetInputs.restoreError(error)
    })
    assetInputs.validate()
    // CSS/独立包可能在 generateBundle 才补充依赖，待整轮完成后统一收集。
    for (const entry of ctx.runtimeState.build.hmr.resolvedEntryMap.keys()) {
      inputFiles.add(entry)
      for (const { sourceId } of ctx.moduleGraphService.getEntryDependencies(entry)) {
        inputFiles.add(sourceId)
      }
    }
    for (const files of [
      getWxmlWatchFiles(ctx),
      ctx.runtimeState.autoRoutes.watchFiles,
      ctx.runtimeState.css.dependencyToImporters.keys(),
      ...ctx.runtimeState.build.independent.watchFiles.values(),
      getWorkerSources(ctx).files,
    ]) {
      for (const file of files) {
        inputFiles.add(file)
      }
    }
    await validateTailwindSnapshotGeneration(ctx as CompilerContext, inputFiles, consumedFiles)
    await validateImportedTailwindSnapshot(sources, inputFiles, consumedFiles)
    const reusableInputs = inputs && coversSnapshotInputs(inputs, inputFiles) && await validateSnapshotInputs(inputs) ? inputs : undefined
    return {
      output,
      getInputFiles: () => [...inputFiles].filter(file => path.isAbsolute(file)),
      getInputs: () => reusableInputs,
      getNativeScriptVersions: () => nativeScriptVersions,
      getNativeScriptDrift: createSnapshotNativeScriptDriftProbe(sources, nativeScriptVersions),
      getChildSources: () => ({
        files: [...new Set([...ctx.runtimeState.build.independent.watchFiles.values()].flatMap(files => [...files]).concat(getWorkerSources(ctx).files))],
        roots: [...ctx.scanService.independentSubPackageMap.keys()].map(root => path.resolve(ctx.configService.absoluteSrcRoot, root)).concat(getWorkerSources(ctx).roots),
      }),
      getGlassEaselAnalysisByOwner: () => ctx.runtimeState.glassEasel.analysisByOwner,
      getEntryIds: () => new Set([...ctx.runtimeState.build.hmr.resolvedEntryMap.keys(), ...inheritedVueEntryIds]),
      getDelegatedComponentEntryIds: () => Array.from(ctx.runtimeState.build.hmr.resolvedEntryMap.keys()).filter(id =>
        /\.(?:vue|jsx|tsx)$/.test(id)
        && ctx.runtimeState.build.hmr.entriesMap.get(ctx.configService.relativeAbsoluteSrcRoot(removeExtensionDeep(id)))?.type === 'component',
      ).concat(inheritedVueEntryIds),
      getGlobalStyleRoutes: () => globalStyleRoutes,
      getTailwindStyleOwners: () => getTailwindStyleOwners(ctx),
    }
  }).finally(() => {
    releaseGeneration()
    ctx.moduleGraphService.resetSession()
  })
}
