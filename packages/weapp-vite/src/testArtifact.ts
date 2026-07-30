import type { InlineConfig } from 'vite'
import path from 'node:path'
import process from 'node:process'
import chokidar from 'chokidar'
import { createCompilerContext } from './createContext'

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

function enqueueBuild<T>(task: () => Promise<T>) {
  const result = pendingBuild.then(task, task)
  pendingBuild = result.then(() => undefined, () => undefined)
  return result
}

function resolveTestOutDir(cwd: string, outDir?: string) {
  return path.resolve(cwd, outDir ?? '.weapp-vite/test-artifacts')
}

export async function buildTestArtifact(options: BuildTestArtifactOptions = {}) {
  return await enqueueBuild(async () => {
    const cwd = path.resolve(options.cwd ?? process.cwd())
    const outDir = resolveTestOutDir(cwd, options.outDir)
    const inlineConfig: InlineConfig = {
      build: {
        emptyOutDir: true,
        outDir,
      },
    }
    const ctx = await createCompilerContext({
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
    await ctx.buildService.build({ skipNpm: options.skipNpm })
    return {
      appConfigPath: path.join(ctx.configService.outDir, 'app.json'),
      miniprogramRootPath: ctx.configService.outDir,
      projectPath: cwd,
      sourceRootPath: ctx.configService.absoluteSrcRoot,
    } satisfies WeappViteTestArtifact
  })
}

export async function watchTestArtifact(options: WatchTestArtifactOptions = {}): Promise<WeappViteTestArtifactWatcher> {
  let artifact = await buildTestArtifact(options)
  let closed = false
  let scheduled: ReturnType<typeof setTimeout> | undefined
  const rebuild = async () => {
    if (closed) {
      throw new Error('The weapp-vite test artifact watcher has already closed.')
    }
    artifact = await buildTestArtifact(options)
    await options.onRebuilt?.(artifact)
    return artifact
  }
  const scheduleRebuild = () => {
    if (closed || scheduled) {
      return
    }
    scheduled = setTimeout(() => {
      scheduled = undefined
      void rebuild().catch(error => options.onError?.(error))
    }, 20)
  }
  const watcher = chokidar.watch(artifact.sourceRootPath, {
    ignoreInitial: true,
    ignored: [artifact.miniprogramRootPath],
  })
  watcher.on('add', scheduleRebuild)
  watcher.on('change', scheduleRebuild)
  watcher.on('unlink', scheduleRebuild)

  return {
    get artifact() {
      return artifact
    },
    async close() {
      if (closed) {
        return
      }
      closed = true
      if (scheduled) {
        clearTimeout(scheduled)
      }
      await watcher.close()
    },
    rebuild,
  }
}
