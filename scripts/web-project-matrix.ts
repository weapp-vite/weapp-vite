import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export type WebProjectExpectation = 'runtime' | 'shell' | 'startup-error'

export interface WebProject {
  id: string
  kind: 'e2e-app' | 'template'
  name: string
  relativeRoot: string
  root: string
  expectation: WebProjectExpectation
}

const PROJECT_GROUPS = [
  { directory: 'e2e-apps', kind: 'e2e-app' },
  { directory: 'templates', kind: 'template' },
] as const

const EXPECTATION_OVERRIDES: Readonly<Record<string, WebProjectExpectation>> = Object.freeze({
  'e2e-apps/lib-mode': 'shell',
  'e2e-apps/script-setup-macros-js-with-defaults-invalid': 'startup-error',
})

interface PackageManifest {
  name?: unknown
  weappVite?: {
    web?: unknown
  }
}

async function readPackageManifest(filename: string) {
  const source = await readFile(filename, 'utf8')
  const manifest = JSON.parse(source) as PackageManifest
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    throw new TypeError(`[web-project-matrix] ${filename} 缺少有效的 package name。`)
  }
  return manifest
}

async function listProjectDirectories(root: string, directory: string) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true })
  return entries
    .filter((entry: Dirent) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

/**
 * 自动发现需要维持 Web 运行契约的 e2e app 与模板项目。
 */
export async function discoverWebProjects(root = path.resolve(import.meta.dirname, '..')): Promise<WebProject[]> {
  const projects: WebProject[] = []
  for (const group of PROJECT_GROUPS) {
    const entries = await listProjectDirectories(root, group.directory)
    for (const entry of entries) {
      const relativeRoot = path.posix.join(group.directory, entry.name)
      const projectRoot = path.join(root, relativeRoot)
      let manifest: PackageManifest
      try {
        manifest = await readPackageManifest(path.join(projectRoot, 'package.json'))
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          continue
        }
        throw error
      }
      if (manifest.weappVite?.web === false) {
        continue
      }
      projects.push({
        id: relativeRoot.replaceAll('/', ':'),
        kind: group.kind,
        name: manifest.name as string,
        relativeRoot,
        root: projectRoot,
        expectation: EXPECTATION_OVERRIDES[relativeRoot] ?? 'runtime',
      })
    }
  }
  return projects
}

export const webProjectExpectationOverrides = EXPECTATION_OVERRIDES
