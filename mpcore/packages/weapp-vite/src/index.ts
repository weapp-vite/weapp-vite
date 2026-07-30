import type { CreateTestProjectOptions, MiniProgramTestProject } from '@mpcore/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createTestProject } from '@mpcore/test'
import { buildTestArtifact, watchTestArtifact } from 'weapp-vite/test'

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

export interface CreateWeappViteTestProjectOptions extends BuildTestArtifactOptions {
  test?: Omit<CreateTestProjectOptions, 'artifact'>
}

const artifactCache = new Map<string, Promise<WeappViteTestArtifact>>()

function cacheKey(options: BuildTestArtifactOptions) {
  return JSON.stringify({
    configFile: options.configFile,
    cwd: path.resolve(options.cwd ?? process.cwd()),
    mode: options.mode ?? 'test',
    outDir: options.outDir,
    projectConfigPath: options.projectConfigPath,
    skipNpm: options.skipNpm,
  })
}

async function artifactExists(artifact: WeappViteTestArtifact) {
  try {
    await fs.access(artifact.appConfigPath)
    return true
  }
  catch {
    return false
  }
}

export async function buildWeappViteTestArtifact(
  options: BuildTestArtifactOptions = {},
): Promise<WeappViteTestArtifact> {
  const key = cacheKey(options)
  const cached = artifactCache.get(key)
  if (cached) {
    const artifact = await cached
    if (await artifactExists(artifact)) {
      return artifact
    }
    artifactCache.delete(key)
  }
  const pending = buildTestArtifact(options)
  artifactCache.set(key, pending)
  try {
    return await pending
  }
  catch (error) {
    artifactCache.delete(key)
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
  return await watchTestArtifact({
    ...options,
    async onRebuilt(artifact) {
      artifactCache.set(cacheKey(options), Promise.resolve(artifact))
      await options.onRebuilt?.(artifact)
    },
  })
}
