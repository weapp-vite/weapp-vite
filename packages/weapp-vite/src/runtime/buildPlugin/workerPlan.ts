import type { EmittedAsset, RolldownOutput } from 'rolldown'
import type { CompilerContext, MutableCompilerContext } from '../../context'
import path from 'pathe'
import { BuildEnvironment, createBuilder } from 'vite'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { getAppBuilder } from './appBuilder'
import { collectIndependentWatchFiles } from './independentWatch'
import { checkWorkersOptions } from './workers'

interface WorkerPlan {
  files: Map<string, Set<string>>
  listeners: Set<(files: string[]) => void>
}
const plans = new WeakMap<MutableCompilerContext, WorkerPlan>()

function plan(ctx: MutableCompilerContext) {
  let value = plans.get(ctx)
  if (!value) {
    value = { files: new Map(), listeners: new Set() }
    plans.set(ctx, value)
  }
  return value
}

export function getWorkerSources(ctx: MutableCompilerContext) {
  const dir = ctx.scanService?.workersDir
  return {
    roots: dir && ctx.configService ? [path.resolve(ctx.configService.absoluteSrcRoot, dir)] : [],
    files: [...new Set([...plan(ctx).files.values()].flatMap(files => [...files]))],
  }
}

export function ownsWorkerSource(ctx: MutableCompilerContext, file: string) {
  const normalized = normalizeFsResolvedId(file)
  const sources = getWorkerSources(ctx)
  return sources.files.includes(normalized) || sources.roots.some(root => normalized === root || normalized.startsWith(`${root}/`))
}

export function observeWorkerSources(ctx: MutableCompilerContext, listener: (files: string[]) => void) {
  const state = plan(ctx)
  state.listeners.add(listener)
  const sources = getWorkerSources(ctx)
  listener([...sources.files, ...sources.roots])
  return () => {
    state.listeners.delete(listener)
  }
}

/** worker 只返回内存产物；主构建统一写出，并接管成功或失败后的输入监听。 */
export async function buildWorkerAssets(ctx: CompilerContext): Promise<EmittedAsset[]> {
  const state = plan(ctx)
  const { workersDir } = checkWorkersOptions(ctx.currentBuildTarget ?? 'app', ctx.configService, ctx.scanService)
  if (!workersDir) {
    state.files.clear()
    return []
  }
  for (const root of state.files.keys()) {
    if (root !== workersDir) {
      state.files.delete(root)
    }
  }
  const child = createCompilerContextInstance()
  const owner = ctx.configService
  try {
    return await child.autoImportService.runWithoutOutputWrites(async () => {
      await child.configService.load({
        ...owner.loadOptions,
        hostConfig: { config: owner.options.sourceConfig ?? {}, path: owner.configFilePath, dependencies: owner.configFileDependencies },
        cwd: owner.cwd,
        mode: owner.mode,
        isDev: owner.isDev,
        emitDefaultAutoImportOutputs: false,
      })
      await child.scanService.loadAppEntry()
      const config = child.configService.mergeWorkers()
      config.configFile = false
      config.builder = { sharedConfigBuild: true }
      config.build = { ...config.build, write: false, watch: null, emptyOutDir: false }
      const watch = collectIndependentWatchFiles(state.files, workersDir, undefined, state.listeners)
      config.plugins = [...config.plugins ?? [], watch.plugin]
      const local = await createBuilder(config, true)
      local.config.environments.weapp_workers = local.config.environments.client!
      const environment = new BuildEnvironment('weapp_workers', local.config)
      await environment.init()
      const builder = getAppBuilder(ctx) ?? local
      builder.environments.weapp_workers = environment
      const result = await builder.build(environment) as RolldownOutput | RolldownOutput[]
      watch.commit()
      return (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output.map(output => ({
        type: 'asset' as const,
        fileName: output.fileName,
        source: output.type === 'chunk' ? output.code : output.source,
      })))
    })
  }
  finally {
    child.moduleGraphService.resetSession()
  }
}
