import type { ExposedPackageId } from './constants'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { EXPOSED_PACKAGES } from './constants'
import { assertInsideRoot } from './workspace'

export interface ResolvedExposedPackage {
  id: ExposedPackageId
  label: string
  packageName: string
  version: string
  absolutePath: string
  relativePath: string
  scripts: string[]
  docs: {
    readme?: string
    changelog?: string
  }
  sourceRoot?: string
  cliPath?: string
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

async function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string) {
  const [realWorkspaceRoot, realAbsolutePath] = await Promise.all([
    fs.realpath(workspaceRoot),
    fs.realpath(absolutePath),
  ])
  const relativePath = path.relative(realWorkspaceRoot, realAbsolutePath)
  if (!relativePath || relativePath === '.') {
    return '.'
  }
  return relativePath
}

async function readPackageJson(filePath: string) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content) as {
    name?: string
    version?: string
    scripts?: Record<string, string>
    bin?: string | Record<string, string>
  }
}

function createWorkspaceRequire(workspaceRoot: string) {
  return createRequire(path.join(workspaceRoot, '__weapp_vite_mcp__.cjs'))
}

async function resolveMonorepoPackage(
  workspaceRoot: string,
  id: ExposedPackageId,
): Promise<ResolvedExposedPackage | undefined> {
  const config = EXPOSED_PACKAGES[id]
  const absolutePath = assertInsideRoot(workspaceRoot, path.join(workspaceRoot, config.relativePath))
  const packageJsonPath = path.join(absolutePath, 'package.json')
  if (!await pathExists(packageJsonPath)) {
    return undefined
  }

  const packageJson = await readPackageJson(packageJsonPath)
  const readmePath = path.join(absolutePath, 'README.md')
  const changelogPath = path.join(absolutePath, 'CHANGELOG.md')
  const sourceRoot = await pathExists(path.join(absolutePath, 'src')) ? absolutePath : undefined
  const cliPath = id === 'weapp-vite'
    ? (await pathExists(path.join(absolutePath, 'bin', 'weapp-vite.js')) ? path.join(absolutePath, 'bin', 'weapp-vite.js') : undefined)
    : undefined

  return {
    id,
    label: config.label,
    packageName: packageJson.name ?? config.packageName,
    version: packageJson.version ?? '0.0.0',
    absolutePath,
    relativePath: config.relativePath,
    scripts: Object.keys(packageJson.scripts ?? {}),
    docs: {
      readme: await pathExists(readmePath) ? readmePath : undefined,
      changelog: await pathExists(changelogPath) ? changelogPath : undefined,
    },
    sourceRoot,
    cliPath,
  }
}

async function resolveInstalledPackage(
  workspaceRoot: string,
  id: ExposedPackageId,
): Promise<ResolvedExposedPackage | undefined> {
  const config = EXPOSED_PACKAGES[id]
  const workspaceRequire = createWorkspaceRequire(workspaceRoot)
  let packageJsonPath: string

  try {
    packageJsonPath = workspaceRequire.resolve(`${config.packageName}/package.json`)
  }
  catch {
    return undefined
  }

  const absolutePath = path.dirname(packageJsonPath)
  const relativePath = await toWorkspaceRelativePath(workspaceRoot, absolutePath)
  const packageJson = await readPackageJson(packageJsonPath)
  const docsRoot = path.join(absolutePath, 'dist', 'docs')
  const installedReadmePath = path.join(docsRoot, 'README.md')
  const installedChangelogPath = path.join(docsRoot, 'CHANGELOG.md')
  const sourceRoot = await pathExists(path.join(absolutePath, 'src')) ? absolutePath : undefined

  let cliPath: string | undefined
  if (id === 'weapp-vite') {
    const binEntry = typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.['weapp-vite']
    if (typeof binEntry === 'string' && binEntry.trim()) {
      const resolvedCliPath = path.resolve(absolutePath, binEntry)
      if (await pathExists(resolvedCliPath)) {
        cliPath = resolvedCliPath
      }
    }
  }

  return {
    id,
    label: config.label,
    packageName: packageJson.name ?? config.packageName,
    version: packageJson.version ?? '0.0.0',
    absolutePath,
    relativePath,
    scripts: Object.keys(packageJson.scripts ?? {}),
    docs: {
      readme: await pathExists(installedReadmePath) ? installedReadmePath : undefined,
      changelog: await pathExists(installedChangelogPath) ? installedChangelogPath : undefined,
    },
    sourceRoot,
    cliPath,
  }
}

export async function resolveExposedPackage(
  workspaceRoot: string,
  id: ExposedPackageId,
): Promise<ResolvedExposedPackage> {
  return await resolveMonorepoPackage(workspaceRoot, id)
    ?? await resolveInstalledPackage(workspaceRoot, id)
    ?? Promise.reject(new Error(`未找到暴露包：${id}`))
}

export async function resolveExposedPackages(workspaceRoot: string) {
  const resolved = await Promise.allSettled(
    (Object.keys(EXPOSED_PACKAGES) as ExposedPackageId[]).map(id => resolveExposedPackage(workspaceRoot, id)),
  )

  return resolved
    .flatMap((result) => {
      if (result.status === 'fulfilled') {
        return [result.value]
      }
      return []
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}
