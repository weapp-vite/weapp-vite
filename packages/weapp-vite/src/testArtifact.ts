import type { InlineConfig } from 'vite'
import path from 'node:path'
import process from 'node:process'
import chokidar from 'chokidar'
import { parseLogicalEntryId, parseSidecarModuleId } from './moduleGraph/protocol'
import { CompilerSession } from './runtime/compilerSession'
import { fingerprintPaths, projectInputFiles, resolveArtifactOutDir } from './testArtifact/inputs'
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
}>()

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
      // 编译期间源码变化不能使旧输出获得新的有效摘要。
      const discoveredStable = await Promise.all([...discoveredInputs].map(async ([file, fingerprint]) =>
        await fingerprint === await fingerprintPaths([file])))
      const stable = discoveredStable.every(Boolean) && before === await fingerprintPaths(initialInputs, [outDir])
      artifactInputs.set(artifact, { paths, fingerprint: stable ? await fingerprintPaths(paths) : '' })
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
  let closing: Promise<void> | undefined
  const watchedInputs = () => artifactInputs.get(artifact)!.paths.filter(file => file !== artifact.miniprogramRootPath
    && (file === artifact.sourceRootPath || !file.startsWith(`${artifact.sourceRootPath}${path.sep}`)))
  let watched = watchedInputs()
  const watcher = chokidar.watch(watched, {
    ignoreInitial: true,
    ignored(file) {
      if (watched.some(input => input === file || input.startsWith(`${file}${path.sep}`))) {
        return false
      }
      return /[/\\](?:node_modules|\.git|\.weapp-vite)(?:[/\\]|$)/.test(file)
        || file === artifact.miniprogramRootPath || file.startsWith(`${artifact.miniprogramRootPath}${path.sep}`)
    },
  })
  const rebuild = (): Promise<WeappViteTestArtifact> => {
    if (closed) {
      return Promise.reject(new Error('The weapp-vite test artifact watcher has already closed.'))
    }
    dirty = true
    if (!active) {
      active = (async () => {
        do {
          dirty = false
          artifact = await buildTestArtifact(options)
          if (!closed) {
            const next = watchedInputs()
            await watcher.unwatch(watched.filter(file => !next.includes(file)))
            watched = next
            watcher.add(watched)
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
      void rebuild().catch((error) => {
        if (!closed) {
          options.onError?.(error)
        }
      })
    }, 20)
  }
  watcher.on('add', scheduleRebuild)
  watcher.on('change', scheduleRebuild)
  watcher.on('unlink', scheduleRebuild)
  watcher.on('error', error => options.onError?.(error))
  try {
    await new Promise<void>((resolve, reject) => {
      watcher.once('ready', resolve)
      watcher.once('error', reject)
    })
    if (!await isTestArtifactCurrent(artifact)) {
      await rebuild()
    }
  }
  catch (error) {
    closed = true
    if (scheduled) {
      clearTimeout(scheduled)
    }
    await watcher.close()
    await active?.catch(() => undefined)
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
      closing = (async () => {
        await watcher.close()
        await active?.catch(() => undefined)
      })()
      return closing
    },
    rebuild,
  }
}
