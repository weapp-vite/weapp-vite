import type { InlineConfig } from 'vite'
import type { ConfigService } from './runtime/config/types'
import path from 'node:path'
import process from 'node:process'
import { parseLogicalEntryId, parseSidecarModuleId } from './moduleGraph/protocol'
import { CompilerSession } from './runtime/compilerSession'
import { createFileWatcher } from './runtime/watch/fileWatcher'
import { createSidecarWatchOptions } from './runtime/watch/options'
import { deduplicateCleanupErrors } from './runtime/watcher/cleanupErrors'
import { fingerprintPaths, projectInputFiles, resolveArtifactOutDir } from './testArtifact/inputs'
import { isPathInside, normalizePath } from './utils/path'
import { captureWatchDependencies } from './utils/watchDependencies'

export interface BuildTestArtifactOptions {
  configFile?: string
  cwd?: string
  mode?: string
  outDir?: string
  projectConfigPath?: string
  skipNpm?: boolean
}

export interface WeappViteTestArtifact {
  appConfigPath: string
  miniprogramRootPath: string
  projectPath: string
  sourceRootPath: string
}

export interface WatchTestArtifactOptions extends BuildTestArtifactOptions {
  onError?: (error: unknown) => void
  onRebuilt?: (artifact: WeappViteTestArtifact) => void | Promise<void>
}

export interface WeappViteTestArtifactWatcher {
  artifact: WeappViteTestArtifact
  close: () => Promise<void>
  rebuild: () => Promise<WeappViteTestArtifact>
}

let pendingBuild: Promise<unknown> = Promise.resolve()
const artifactInputs = new WeakMap<WeappViteTestArtifact, {
  fingerprint: string
  paths: string[]
  watchConfig: Pick<ConfigService, 'inlineConfig'>
}>()

/** 监听策略属于产物启动快照，后续编译配置变动不能改写已登记策略。 */
function captureArtifactWatchConfig(config: Pick<ConfigService, 'inlineConfig'>): Pick<ConfigService, 'inlineConfig'> {
  const inline = config.inlineConfig
  const buildWatch = inline?.build?.watch
  const serverWatch = inline?.server?.watch
  const watchOptions = createSidecarWatchOptions(config, {})
  const buildChokidar = buildWatch && typeof buildWatch === 'object' && 'chokidar' in buildWatch ? buildWatch.chokidar : undefined
  return {
    inlineConfig: {
      ...inline,
      build: {
        ...inline?.build,
        watch: {
          ...(buildWatch && typeof buildWatch === 'object' ? buildWatch : {}),
          ...{
            chokidar: { ...buildChokidar, ...watchOptions },
          },
        },
      },
      server: inline?.server
        ? { ...inline.server, watch: serverWatch && typeof serverWatch === 'object' ? { ...serverWatch } : serverWatch }
        : undefined,
    },
  }
}

function enqueueBuild<T>(task: () => Promise<T>) {
  const result = pendingBuild.then(task, task)
  pendingBuild = result.then(() => undefined, () => undefined)
  return result
}

export async function isTestArtifactCurrent(artifact: WeappViteTestArtifact) {
  const inputs = artifactInputs.get(artifact)
  return inputs !== undefined && inputs.fingerprint === await fingerprintPaths(inputs.paths)
}

export async function buildTestArtifact(options: BuildTestArtifactOptions = {}) {
  return await enqueueBuild(async () => {
    const session = new CompilerSession()
    try {
      const cwd = path.resolve(options.cwd ?? process.cwd())
      const outDir = resolveArtifactOutDir(cwd, options)
      const dependencies = new Set(projectInputFiles(cwd))
      const discoveredInputs = new Map<string, Promise<string>>()
      const inlineConfig: InlineConfig = {
        plugins: [captureWatchDependencies((file) => {
          dependencies.add(file)
          if (!discoveredInputs.has(file)) {
            discoveredInputs.set(file, fingerprintPaths([file]))
          }
        }), {
          name: 'weapp-vite:test-artifact-inputs',
          generateBundle() {
            for (const file of this.getModuleIds()) {
              const clean = (parseLogicalEntryId(file)?.sourceId ?? parseSidecarModuleId(file)?.ownerId ?? file).split('?')[0]!
              if (path.isAbsolute(clean)) {
                dependencies.add(clean)
                for (const dependency of session.context.moduleGraphService.getTransformDependencies(clean)) {
                  dependencies.add(dependency)
                }
                for (const dependency of session.context.moduleGraphService.getEntryDependencies(clean)) {
                  dependencies.add(dependency.sourceId)
                }
              }
            }
          },
        }],
        build: {
          emptyOutDir: true,
          outDir,
        },
      }
      const ctx = await session.initialize({
        cwd,
        mode: options.mode ?? 'test',
        isDev: false,
        configFile: options.configFile,
        inlineConfig,
        outputRoot: outDir,
        projectConfigPath: options.projectConfigPath,
        emitDefaultAutoImportOutputs: false,
        preloadAppEntry: false,
        syncSupportFiles: false,
      })
      const watchConfig = captureArtifactWatchConfig(ctx.configService)
      for (const file of ctx.configService.configFileDependencies ?? []) {
        dependencies.add(file)
      }
      if (options.projectConfigPath) {
        dependencies.add(path.resolve(cwd, options.projectConfigPath))
      }
      dependencies.add(ctx.configService.absoluteSrcRoot)
      const initialInputs = [...dependencies]
      const before = await fingerprintPaths(initialInputs, [outDir])
      await session.run(() => ctx.buildService.build({ skipNpm: options.skipNpm }))
      const artifact = {
        appConfigPath: path.join(ctx.configService.outDir, 'app.json'),
        miniprogramRootPath: ctx.configService.outDir,
        projectPath: cwd,
        sourceRootPath: ctx.configService.absoluteSrcRoot,
      } satisfies WeappViteTestArtifact
      const paths = [...dependencies, outDir]
      // 先捕获待发布摘要，再校验输入；校验之后不能重新读取变化中的输入。
      const fingerprint = await fingerprintPaths(paths)
      const discoveredStable = await Promise.all([...discoveredInputs].map(async ([file, fingerprint]) =>
        await fingerprint === await fingerprintPaths([file])))
      const stable = discoveredStable.every(Boolean) && before === await fingerprintPaths(initialInputs, [outDir])
      artifactInputs.set(artifact, { paths, fingerprint: stable ? fingerprint : '', watchConfig })
      return artifact
    }
    finally {
      await session.close()
    }
  })
}

export async function watchTestArtifact(options: WatchTestArtifactOptions = {}): Promise<WeappViteTestArtifactWatcher> {
  let artifact = await buildTestArtifact(options)
  let closed = false
  let scheduled: ReturnType<typeof setTimeout> | undefined
  let active: Promise<WeappViteTestArtifact> | undefined
  let dirty = false
  let forced = false
  let closing: Promise<void> | undefined
  const watchedInputs = () => [...new Map(artifactInputs.get(artifact)!.paths.map(file => [normalizePath(file), file])).values()]
    .filter(file => !isPathInside(artifact.miniprogramRootPath, file)
      && (normalizePath(file) === normalizePath(artifact.sourceRootPath) || !isPathInside(artifact.sourceRootPath, file)))
  let watched = watchedInputs()
  const watcher = createFileWatcher(artifactInputs.get(artifact)!.watchConfig, watched, {
    ignoreInitial: true,
    ignored(file) {
      if (watched.some(input => isPathInside(file, input))) {
        return false
      }
      return /[/\\](?:node_modules|\.git|\.weapp-vite)(?:[/\\]|$)/.test(file)
        || isPathInside(artifact.miniprogramRootPath, file)
    },
  })
  const closeResources = async (priorFailures: unknown[] = []) => {
    const results = await Promise.allSettled([watcher.close(), active])
    const failures = deduplicateCleanupErrors([
      ...priorFailures,
      ...results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map(result => result.reason),
    ])
    if (failures.length) {
      throw failures.length === 1 ? failures[0] : new AggregateError(failures, 'Test artifact watcher cleanup failed', { cause: failures[0] })
    }
  }
  const requestRebuild = (force: boolean): Promise<WeappViteTestArtifact> => {
    if (closed) {
      return Promise.reject(new Error('The weapp-vite test artifact watcher has already closed.'))
    }
    dirty = true
    forced ||= force
    if (!active) {
      active = (async () => {
        do {
          dirty = false
          const forceBuild = forced
          forced = false
          // 文件通知只表示可能变脏；迟到或重复通知不能为相同输入再次发布产物。
          if (!forceBuild && await isTestArtifactCurrent(artifact)) {
            continue
          }
          if (closed) {
            break
          }
          artifact = await buildTestArtifact(options)
          if (!closed) {
            const next = watchedInputs()
            watched = next
            await watcher.updateTargets(watched)
            await options.onRebuilt?.(artifact)
          }
          if (closed) {
            break
          }
        } while (dirty)
        return artifact
      })().finally(() => {
        active = undefined
      })
    }
    return active
  }
  const scheduleRebuild = () => {
    if (closed || scheduled) {
      return
    }
    scheduled = setTimeout(() => {
      scheduled = undefined
      void requestRebuild(false).catch((error) => {
        if (!closed) {
          options.onError?.(error)
        }
      })
    }, 20)
  }
  watcher.onChange((changes) => {
    if (changes.some(change => change.kind === 'file')) {
      scheduleRebuild()
    }
  })
  watcher.onError(error => options.onError?.(error))
  try {
    await watcher.ready
    if (!await isTestArtifactCurrent(artifact)) {
      await requestRebuild(false)
    }
  }
  catch (error) {
    closed = true
    if (scheduled) {
      clearTimeout(scheduled)
    }
    closing = closeResources([error])
    await closing
    throw error
  }

  return {
    get artifact() {
      return artifact
    },
    close() {
      if (closing) {
        return closing
      }
      closed = true
      if (scheduled) {
        clearTimeout(scheduled)
      }
      closing = closeResources()
      return closing
    },
    rebuild: () => requestRebuild(true),
  }
}
