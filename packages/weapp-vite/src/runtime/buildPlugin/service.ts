import type PQueue from 'p-queue'
import type {
  RolldownOutput,
  RolldownWatcher,
} from 'rolldown'
import type { BuildTarget, MutableCompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import process from 'node:process'
import { build } from 'vite'
import { debug, logger } from '../../context/shared'
import { syncProjectConfigToOutput } from '../../utils/projectConfig'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { createIndependentBuilder } from './independent'
import { cleanOutputs } from './outputs'
import { buildWorkers, checkWorkersOptions, devWorkers, watchWorkers } from './workers'

export interface BuildOptions {
  skipNpm?: boolean
}

export interface BuildService {
  queue: PQueue
  build: (options?: BuildOptions) => Promise<RolldownOutput | RolldownOutput[] | RolldownWatcher>
  buildIndependentBundle: (root: string, meta: SubPackageMetaValue) => Promise<RolldownOutput>
  getIndependentOutput: (root: string) => RolldownOutput | undefined
  invalidateIndependentOutput: (root: string) => void
}

export function createBuildService(ctx: MutableCompilerContext): BuildService {
  function assertRuntimeServices(target: MutableCompilerContext): asserts target is MutableCompilerContext & {
    configService: NonNullable<MutableCompilerContext['configService']>
    watcherService: NonNullable<MutableCompilerContext['watcherService']>
    npmService: NonNullable<MutableCompilerContext['npmService']>
    scanService: NonNullable<MutableCompilerContext['scanService']>
  } {
    if (!target.configService || !target.watcherService || !target.npmService || !target.scanService) {
      throw new Error('构建服务需要先初始化 config、watcher、npm 和 scan 服务。')
    }
  }

  assertRuntimeServices(ctx)

  const { configService, watcherService, npmService, scanService } = ctx
  const buildState = ctx.runtimeState.build
  const { queue } = buildState

  const {
    buildIndependentBundle,
    getIndependentOutput,
    invalidateIndependentOutput,
  } = createIndependentBuilder(configService, buildState)

  async function runDev(target: BuildTarget) {
    if (process.env.NODE_ENV === undefined) {
      process.env.NODE_ENV = 'development'
    }
    debug?.(`[${target}] dev build watcher start`)
    const { hasWorkersDir, workersDir } = checkWorkersOptions(target, configService, scanService)
    const buildOptions = configService.merge(
      undefined,
      createSharedBuildConfig(configService, scanService),
    )
    const watcherPromise = build(
      buildOptions,
    ) as unknown as Promise<RolldownWatcher>
    const workerPromise = target === 'app' && hasWorkersDir && workersDir
      ? devWorkers(configService, watcherService, workersDir)
      : Promise.resolve()
    const [watcher] = await Promise.all([watcherPromise, workerPromise])
    const isTestEnv = process.env.VITEST === 'true'
      || process.env.NODE_ENV === 'test'

    if (target === 'app' && hasWorkersDir && workersDir && !isTestEnv) {
      watchWorkers(configService, watcherService, workersDir)
    }

    debug?.('dev build watcher end')
    debug?.('dev watcher listen start')

    let startTime: DOMHighResTimeStamp

    let resolveWatcher: (value: unknown) => void
    let rejectWatcher: (reason?: any) => void
    const promise = new Promise((res, rej) => {
      resolveWatcher = res
      rejectWatcher = rej
    })
    watcher.on('event', (e) => {
      if (e.code === 'START') {
        startTime = performance.now()
      }
      else if (e.code === 'END') {
        logger.success(`构建完成，耗时 ${(performance.now() - startTime).toFixed(2)} ms`)
        resolveWatcher(e)
      }
      else if (e.code === 'ERROR') {
        rejectWatcher(e)
      }
    })
    await promise

    const watcherRoot = target === 'plugin'
      ? configService.absolutePluginRoot ?? configService.absoluteSrcRoot
      : '/'
    watcherService.setRollupWatcher(watcher, watcherRoot)
    return watcher
  }

  async function runProd(target: BuildTarget) {
    debug?.(`[${target}] prod build start`)
    const { hasWorkersDir } = checkWorkersOptions(target, configService, scanService)
    const bundlerPromise = build(
      configService.merge(
        undefined,
        createSharedBuildConfig(configService, scanService),
      ),
    )
    const workerPromise = target === 'app' && hasWorkersDir ? buildWorkers(configService) : Promise.resolve()
    const [output] = await Promise.all([bundlerPromise, workerPromise])

    debug?.(`[${target}] prod build end`)
    return output as RolldownOutput | RolldownOutput[]
  }

  function scheduleNpmBuild(options?: BuildOptions) {
    if (options?.skipNpm) {
      return Promise.resolve()
    }

    const runTask = () => queue.add(async () => {
      await npmService.build()
      if (configService.isDev) {
        buildState.npmBuilt = true
      }
    })

    if (configService.isDev) {
      return (async () => {
        const isDependenciesOutdated = await npmService.checkDependenciesCacheOutdate()
        if (!isDependenciesOutdated && buildState.npmBuilt) {
          return
        }
        if (isDependenciesOutdated) {
          buildState.npmBuilt = false
        }
        const task = runTask()
        queue.start()
        await task
      })()
    }

    const task = runTask()
    queue.start()
    return task
  }

  async function runBuildTarget(target: BuildTarget) {
    ctx.currentBuildTarget = target
    if (configService.isDev) {
      return await runDev(target)
    }
    return await runProd(target)
  }

  async function buildEntry(options?: BuildOptions) {
    await cleanOutputs(configService)
    const multiPlatformConfig = configService.weappViteConfig.multiPlatform
    const isMultiPlatformEnabled = Boolean(
      multiPlatformConfig
      && (typeof multiPlatformConfig !== 'object' || multiPlatformConfig.enabled !== false),
    )
    await syncProjectConfigToOutput({
      outDir: configService.outDir,
      projectConfigPath: configService.projectConfigPath,
      projectPrivateConfigPath: configService.projectPrivateConfigPath,
      enabled: isMultiPlatformEnabled,
    })
    debug?.('build start')
    const npmBuildTask = scheduleNpmBuild(options)
    const result = await runBuildTarget('app')
    await npmBuildTask
    if (configService.absolutePluginRoot) {
      await runBuildTarget('plugin')
    }
    debug?.('build end')
    return result
  }

  return {
    queue,
    build: buildEntry,
    buildIndependentBundle,
    getIndependentOutput,
    invalidateIndependentOutput,
  }
}
