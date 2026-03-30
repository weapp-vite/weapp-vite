import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))
const FIXTURE_PROJECTS_DIR = path.resolve(ROOT_DIR, 'test/fixture-projects/weapp-vite')
const WEAPP_VITE_SRC_DIR = path.resolve(ROOT_DIR, 'packages/weapp-vite/src')
const WEAPP_VITE_STUB_ENTRIES = {
  '.': path.join(WEAPP_VITE_SRC_DIR, 'index.ts'),
  './config': path.join(WEAPP_VITE_SRC_DIR, 'config.ts'),
  './json': path.join(WEAPP_VITE_SRC_DIR, 'json.ts'),
  './auto-routes': path.join(WEAPP_VITE_SRC_DIR, 'auto-routes.ts'),
  './mcp': path.join(WEAPP_VITE_SRC_DIR, 'mcp.ts'),
  './auto-import-components/resolvers': path.join(WEAPP_VITE_SRC_DIR, 'auto-import-components/resolvers/index.ts'),
} as const
const FIXTURE_BUILD_DIR_NAMES = new Set([
  'dist',
  '.weapp-vite',
])

async function cleanupFixtureProjects() {
  let entries: Awaited<ReturnType<typeof fs.readdir>> = []

  try {
    entries = await fs.readdir(FIXTURE_PROJECTS_DIR, { withFileTypes: true })
  }
  catch {
    return
  }

  await Promise.all(entries
    .filter(entry => entry.isDirectory())
    .map(async (entry) => {
      const fixtureRoot = path.join(FIXTURE_PROJECTS_DIR, entry.name)
      const children = await fs.readdir(fixtureRoot, { withFileTypes: true }).catch(() => [])

      await Promise.all(children
        .filter(child => child.isDirectory())
        .filter(child => FIXTURE_BUILD_DIR_NAMES.has(child.name))
        .map(child => fs.rm(path.join(fixtureRoot, child.name), { recursive: true, force: true })))

      // 清理历史测试遗留的嵌套 node_modules，避免旧的 stub 包污染 workspace 解析。
      await Promise.all(children
        .filter(child => child.isDirectory())
        .map(async (child) => {
          const nestedNodeModules = path.join(fixtureRoot, child.name, 'node_modules')
          await fs.rm(nestedNodeModules, { recursive: true, force: true })
        }))
    }))

  await fs.rm(path.resolve(ROOT_DIR, 'test/.cache'), { recursive: true, force: true })
  await fs.rm(path.resolve(FIXTURE_PROJECTS_DIR, '__temp__'), { recursive: true, force: true })
  const rootEntries = await fs.readdir(FIXTURE_PROJECTS_DIR, { withFileTypes: true }).catch(() => [])
  await Promise.all(rootEntries
    .filter(entry => entry.isDirectory())
    .filter(entry => entry.name.startsWith('.tmp-'))
    .map(entry => fs.rm(path.join(FIXTURE_PROJECTS_DIR, entry.name), { recursive: true, force: true })))
}

async function ensureWorkspacePackageLink(projectRoot: string) {
  void projectRoot
  return

  const projectNodeModulesDir = path.join(projectRoot, 'node_modules')
  const packageRoot = path.join(projectNodeModulesDir, 'weapp-vite')
  const autoImportDir = path.join(packageRoot, 'auto-import-components')

  const existingStat = await fs.lstat(packageRoot).catch(() => null)
  if (existingStat && !existingStat.isDirectory()) {
    await fs.rm(packageRoot, { recursive: true, force: true })
  }

  await fs.mkdir(autoImportDir, { recursive: true })
  await fs.writeFile(path.join(packageRoot, 'package.json'), `${JSON.stringify({
    name: 'weapp-vite',
    private: true,
    type: 'module',
    exports: WEAPP_VITE_STUB_ENTRIES,
  }, null, 2)}\n`, 'utf8')

  await Promise.all(Object.entries(WEAPP_VITE_STUB_ENTRIES).map(async ([exportName, targetPath]) => {
    const relativeName = exportName === '.'
      ? 'index.mjs'
      : exportName === './auto-import-components/resolvers'
        ? 'auto-import-components/resolvers.mjs'
        : `${exportName.slice(2)}.mjs`
    const target = pathToFileURL(targetPath).href
    await fs.writeFile(path.join(packageRoot, relativeName), `export * from ${JSON.stringify(target)}\n`, 'utf8')
  }))
}

async function ensureExternalProjectPackageLinks() {
  let entries: Awaited<ReturnType<typeof fs.readdir>> = []

  try {
    entries = await fs.readdir(FIXTURE_PROJECTS_DIR, { withFileTypes: true })
  }
  catch {
    entries = []
  }

  await Promise.all(entries
    .filter(entry => entry.isDirectory())
    .map(entry => ensureWorkspacePackageLink(path.join(FIXTURE_PROJECTS_DIR, entry.name))))

  await ensureWorkspacePackageLink(path.resolve(ROOT_DIR, 'apps/plugin-demo'))
}

export default async function setup() {
  await fs.mkdir(path.resolve(ROOT_DIR, 'coverage/.tmp'), { recursive: true })
  await cleanupFixtureProjects()
  await ensureExternalProjectPackageLinks()
}
