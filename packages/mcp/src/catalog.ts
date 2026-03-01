import type { ExposedPackageId } from './constants'
import fs from 'node:fs/promises'
import path from 'node:path'
import { EXPOSED_PACKAGES } from './constants'
import { assertInsideRoot } from './workspace'

export interface ExposedPackageSummary {
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
}

async function readJsonFile<T = Record<string, any>>(filePath: string) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content) as T
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

export async function loadPackageSummary(workspaceRoot: string, id: ExposedPackageId): Promise<ExposedPackageSummary> {
  const config = EXPOSED_PACKAGES[id]
  const absolutePath = assertInsideRoot(workspaceRoot, path.join(workspaceRoot, config.relativePath))
  const packageJsonPath = path.join(absolutePath, 'package.json')
  const packageJson = await readJsonFile<{
    name?: string
    version?: string
    scripts?: Record<string, string>
  }>(packageJsonPath)

  const readmePath = path.join(absolutePath, 'README.md')
  const changelogPath = path.join(absolutePath, 'CHANGELOG.md')

  return {
    id,
    label: config.label,
    packageName: packageJson.name ?? config.label,
    version: packageJson.version ?? '0.0.0',
    absolutePath,
    relativePath: config.relativePath,
    scripts: Object.keys(packageJson.scripts ?? {}),
    docs: {
      readme: await pathExists(readmePath) ? readmePath : undefined,
      changelog: await pathExists(changelogPath) ? changelogPath : undefined,
    },
  }
}

export async function loadExposedCatalog(workspaceRoot: string) {
  const summaries = await Promise.all(
    Object.keys(EXPOSED_PACKAGES).map(id => loadPackageSummary(workspaceRoot, id as ExposedPackageId)),
  )

  return summaries.sort((a, b) => a.id.localeCompare(b.id))
}
