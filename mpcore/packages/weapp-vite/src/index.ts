import type { CreateTestProjectOptions, MiniProgramTestProject } from '@mpcore/test'
import type { BuildTestArtifactOptions, WatchTestArtifactOptions, WeappViteTestArtifact, WeappViteTestArtifactWatcher } from 'weapp-vite/test'
import path from 'node:path'
import process from 'node:process'
import { createTestProject } from '@mpcore/test'
import { buildTestArtifact, isTestArtifactCurrent, watchTestArtifact } from 'weapp-vite/test'

export type { BuildTestArtifactOptions, WatchTestArtifactOptions, WeappViteTestArtifact, WeappViteTestArtifactWatcher } from 'weapp-vite/test'

export interface CreateWeappViteTestProjectOptions extends BuildTestArtifactOptions {
  test?: Omit<CreateTestProjectOptions, 'artifact'>
}

const artifactCache = new Map<string, Promise<WeappViteTestArtifact>>()

function cacheKey(options: BuildTestArtifactOptions) {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  return JSON.stringify({
    configFile: options.configFile && path.resolve(cwd, options.configFile),
    cwd,
    mode: options.mode ?? 'test',
    outDir: options.outDir && path.resolve(cwd, options.outDir),
    projectConfigPath: options.projectConfigPath && path.resolve(cwd, options.projectConfigPath),
    skipNpm: options.skipNpm ?? false,
  })
}

export async function buildWeappViteTestArtifact(
  options: BuildTestArtifactOptions = {},
): Promise<WeappViteTestArtifact> {
  const key = cacheKey(options)
  const cached = artifactCache.get(key)
  const pending = (async () => {
    if (cached) {
      const artifact = await cached.catch(() => undefined)
      if (artifact && await isTestArtifactCurrent(artifact)) {
        return artifact
      }
    }
    return await buildTestArtifact(options)
  })()
  artifactCache.set(key, pending)
  try {
    return await pending
  }
  catch (error) {
    if (artifactCache.get(key) === pending) {
      artifactCache.delete(key)
    }
    throw error
  }
}

export function clearWeappViteTestArtifactCache(options?: BuildTestArtifactOptions) {
  if (options) {
    artifactCache.delete(cacheKey(options))
    return
  }
  artifactCache.clear()
}

export async function createWeappViteTestProject(
  options: CreateWeappViteTestProjectOptions = {},
): Promise<MiniProgramTestProject> {
  const { test, ...buildOptions } = options
  const artifact = await buildWeappViteTestArtifact(buildOptions)
  return createTestProject({
    ...test,
    artifact,
  })
}

export async function watchWeappViteTestArtifact(
  options: WatchTestArtifactOptions = {},
): Promise<WeappViteTestArtifactWatcher> {
  clearWeappViteTestArtifactCache(options)
  const watcher = await watchTestArtifact({
    ...options,
    async onRebuilt(artifact) {
      artifactCache.set(cacheKey(options), Promise.resolve(artifact))
      await options.onRebuilt?.(artifact)
    },
  })
  artifactCache.set(cacheKey(options), Promise.resolve(watcher.artifact))
  return watcher
}
