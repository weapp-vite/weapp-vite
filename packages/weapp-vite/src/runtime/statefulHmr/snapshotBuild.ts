import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../context'
import type { LoadConfigOptions } from '../config/types'
import { readFile } from 'node:fs/promises'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { build } from 'vite'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { createPublicAssetSourcePlan } from '../../plugins/asset/publicSources'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { getTailwindStyleOwners } from '../../plugins/tailwindcss/styleOwners'
import { setCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { shareWxmlDependencies } from '../../wxml/processing/dependencies'
import { getWorkerSources } from '../buildPlugin/workerPlan'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { resolveComponentPageGlobalStyleRoutes } from './componentPageStyles'

/** 快照独立编译；初始化到构建收尾均不写支持文件，由活动 DevEngine 统一维护。 */
export async function buildStatefulHmrSnapshot(
  loadOptions: LoadConfigOptions,
  configure: (options: InlineConfig) => InlineConfig = options => options,
  owner?: Pick<MutableCompilerContext, 'runtimeState' | 'configService'>,
  sources?: ReadonlyMap<string, string | null>,
) {
  const ctx = createCompilerContextInstance()
  if (owner) {
    shareWxmlDependencies(owner, ctx)
  }
  return await ctx.autoImportService.runWithoutOutputWrites(async () => {
    ctx.currentBuildTarget = 'app'
    const ownerConfig = owner?.configService
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
      async generateBundle(_options, bundle) {
        // 资产快照随后会删除 JS chunk，必须在完整产物阶段确认页面注册与样式边界。
        globalStyleRoutes = resolveComponentPageGlobalStyleRoutes(Object.values(bundle), ctx.runtimeState.build.hmr.componentPageStyleOptions)
        // write:false 不运行 Vite 的 public 复制阶段；把未被编译产物覆盖的文件交给原生资产写出。
        for (const file of await publicAssets?.scan() ?? []) {
          const fileName = publicAssets!.outputName(file)
          if (!bundle[fileName]) {
            this.emitFile({ type: 'asset', fileName, source: await readFile(file) })
          }
        }
      },
    }]
    const options = configure(baseOptions)
    options.build = { ...options.build, watch: undefined, write: false }
    if (sources) {
      options.plugins = [{
        name: 'weapp-vite:snapshot-input',
        enforce: 'pre',
        load: {
          order: 'pre',
          handler(id) {
            if (id.startsWith('\0') || id.includes('?')) {
              return null
            }
            const sourceId = normalizeFsResolvedId(id)
            const nativeEntry = ctx.runtimeState.build.hmr.entriesMap.get(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(sourceId)))
            // 发现的组件记录暂时指向引用它的入口；按注册身份保留原生加载及其伴随资产输出。
            if (sourceId.endsWith('.vue') || nativeEntry
              || (ctx.scanService.appEntry?.path && normalizeFsResolvedId(ctx.scanService.appEntry.path) === sourceId)) {
              return null
            }
            const source = sources.get(compilerSourceId(id))
            if (source === null) {
              throw new Error(`Source removed from snapshot: ${id}`)
            }
            return source === undefined ? null : { code: source }
          },
        },
      }, ...(options.plugins ?? [])]
    }
    const output = await build(options)
    return {
      output,
      getChildSources: () => ({
        files: [...new Set([...ctx.runtimeState.build.independent.watchFiles.values()].flatMap(files => [...files]).concat(getWorkerSources(ctx).files))],
        roots: [...ctx.scanService.independentSubPackageMap.keys()].map(root => path.resolve(ctx.configService.absoluteSrcRoot, root)).concat(getWorkerSources(ctx).roots),
      }),
      getGlassEaselAnalysisByOwner: () => ctx.runtimeState.glassEasel.analysisByOwner,
      getEntryIds: () => ctx.runtimeState.build.hmr.resolvedEntryMap.keys(),
      getDelegatedComponentEntryIds: () => Array.from(ctx.runtimeState.build.hmr.resolvedEntryMap.keys()).filter(id =>
        /\.(?:vue|jsx|tsx)$/.test(id)
        && ctx.runtimeState.build.hmr.entriesMap.get(ctx.configService.relativeAbsoluteSrcRoot(removeExtensionDeep(id)))?.type === 'component',
      ),
      getGlobalStyleRoutes: () => globalStyleRoutes,
      getTailwindStyleOwners: () => getTailwindStyleOwners(ctx),
    }
  }).finally(() => ctx.moduleGraphService.resetSession())
}
