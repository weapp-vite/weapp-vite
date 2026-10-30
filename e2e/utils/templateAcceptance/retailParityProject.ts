import fs, { cp, lstat, mkdir, mkdtemp, readFile, realpath, symlink } from 'node:fs/promises'
import path from 'node:path'

interface RetailParityProjectOptions {
  parentDirectory?: string
}

interface ProjectManifest {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const generatedDirectories = new Set(['dist', 'node_modules', '.weapp-vite', '.tmp', '.cache', '.turbo', '.git', 'coverage'])
const defaultParentDirectory = path.resolve(import.meta.dirname, '../../../.tmp/e2e-projects/retail-parity')

/** 为零售结构对照复制独占项目，配置变更与构建产物均保留在当前副本内。 */
export async function createRetailParityProject(sourceRoot: string, options: RetailParityProjectOptions = {}) {
  const source = await realpath(sourceRoot)
  const parent = path.resolve(options.parentDirectory ?? defaultParentDirectory)
  await mkdir(parent, { recursive: true })
  const relativeParent = path.relative(source, await realpath(parent))
  if (!relativeParent || (!path.isAbsolute(relativeParent) && relativeParent !== '..' && !relativeParent.startsWith(`..${path.sep}`))) {
    throw new Error('Retail parity project parent must be outside the source project')
  }
  const projectRoot = await mkdtemp(path.join(parent, 'fixture-'))
  const identity = await lstat(projectRoot)
  const runtimeHolds = new Set<symbol>()
  let cleanupTask: Promise<void> | undefined
  const retainRuntime = () => {
    if (cleanupTask) {
      throw new Error('Cannot retain retail parity runtime after project cleanup has started')
    }
    const hold = Symbol('retail parity runtime')
    runtimeHolds.add(hold)
    return () => {
      runtimeHolds.delete(hold)
    }
  }
  const cleanup = (): Promise<void> => {
    if (runtimeHolds.size) {
      return Promise.reject(new Error('Cannot clean retail parity project while runtime ownership remains active'))
    }
    cleanupTask ??= (async () => {
      const current = await lstat(projectRoot).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error
        }
      })
      // 原路径被另一目录或链接替换后，不沿用旧项目的删除权。
      if (current?.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino) {
        await fs.rm(projectRoot, { recursive: true, force: true })
      }
    })().catch((error: unknown) => {
      cleanupTask = undefined
      throw error
    })
    return cleanupTask
  }
  try {
    await cp(source, projectRoot, {
      recursive: true,
      dereference: true,
      filter: entry => !path.relative(source, entry).split(path.sep).some(segment => generatedDirectories.has(segment)),
    })
    const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')) as ProjectManifest
    const dependencies = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})])
    await mkdir(path.join(projectRoot, 'node_modules'))
    for (const name of dependencies) {
      const installed = await realpath(path.join(source, 'node_modules', name))
      const target = path.join(projectRoot, 'node_modules', name)
      await mkdir(path.dirname(target), { recursive: true })
      // 分别链接真实依赖，避免 Windows 整目录 junction 再穿过 pnpm 链接。
      await symlink(installed, target, 'junction')
    }
    return { projectRoot, cleanup, retainRuntime }
  }
  catch (error) {
    try {
      await cleanup()
    }
    catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Retail parity project preparation and cleanup failed', { cause: error })
    }
    throw error
  }
}
