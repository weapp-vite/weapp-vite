import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.dirname(fileURLToPath(new URL(import.meta.url)))
const FIXTURE_PROJECTS_DIR = path.resolve(ROOT_DIR, 'test/fixture-projects/weapp-vite')
const WORKSPACE_PROJECT_DIRS = [
  'apps',
  'templates',
  'e2e-apps',
  'test/fixture-projects/weapp-vite',
]
const FIXTURE_BUILD_DIR_NAMES = new Set([
  'dist',
  '.weapp-vite',
])
const MANAGED_TSCONFIG_DIRNAME = '.weapp-vite'
const MANAGED_TSCONFIG_FILES = {
  'tsconfig.shared.empty.d.ts': 'export {}\n',
  'tsconfig.shared.json': `${JSON.stringify({
    compilerOptions: {
      target: 'ES2023',
      module: 'ESNext',
      moduleResolution: 'bundler',
      moduleDetection: 'force',
      resolveJsonModule: true,
      allowImportingTsExtensions: true,
      strict: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noEmit: true,
      verbatimModuleSyntax: true,
      noUncheckedSideEffectImports: true,
      erasableSyntaxOnly: true,
      skipLibCheck: true,
    },
    files: ['./tsconfig.shared.empty.d.ts'],
  }, null, 2)}\n`,
  'tsconfig.app.json': `${JSON.stringify({
    extends: './tsconfig.shared.json',
    compilerOptions: {
      tsBuildInfoFile: '../node_modules/.tmp/tsconfig.app.tsbuildinfo',
      target: 'ES2023',
      lib: ['ES2023', 'DOM'],
      jsx: 'preserve',
      resolveJsonModule: true,
      allowJs: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      isolatedModules: true,
      types: ['miniprogram-api-typings', 'weapp-vite/client'],
      paths: {
        '@/*': ['../src/*'],
      },
    },
    vueCompilerOptions: {
      plugins: ['weapp-vite/volar'],
    },
    include: [
      '../src/**/*',
      '../types/**/*.d.ts',
      '../env.d.ts',
      './**/*.d.ts',
    ],
  }, null, 2)}\n`,
  'tsconfig.node.json': `${JSON.stringify({
    extends: './tsconfig.shared.json',
    compilerOptions: {
      tsBuildInfoFile: '../node_modules/.tmp/tsconfig.node.tsbuildinfo',
      target: 'ES2023',
      lib: ['ES2023'],
      types: ['node'],
    },
    include: [
      '../vite.config.ts',
      '../vite.config.*.ts',
      '../vite.config.mts',
      '../vite.config.*.mts',
      '../weapp-vite.config.ts',
      '../weapp-vite.config.*.ts',
      '../weapp-vite.config.mts',
      '../weapp-vite.config.*.mts',
      '../*.config.ts',
      '../*.config.mts',
      '../config/**/*.ts',
      '../config/**/*.mts',
      '../scripts/**/*.ts',
      '../scripts/**/*.mts',
    ],
  }, null, 2)}\n`,
  'tsconfig.server.json': `${JSON.stringify({
    extends: './tsconfig.shared.json',
    compilerOptions: {
      tsBuildInfoFile: '../node_modules/.tmp/tsconfig.server.tsbuildinfo',
      target: 'ES2023',
      lib: ['ES2023'],
      types: ['node'],
    },
    files: [],
  }, null, 2)}\n`,
}

async function cleanupFixtureProjects() {
  let entries = []

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

async function ensureExternalProjectPackageLinks() {
  return undefined
}

async function hasManagedTsconfigReference(projectRoot) {
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
  const content = await fs.readFile(tsconfigPath, 'utf8').catch(() => '')
  return content.includes(`${MANAGED_TSCONFIG_DIRNAME}/tsconfig.`)
}

async function syncManagedTsconfigBootstrapFiles(projectRoot) {
  if (!await hasManagedTsconfigReference(projectRoot)) {
    return
  }

  const managedDir = path.join(projectRoot, MANAGED_TSCONFIG_DIRNAME)
  await fs.mkdir(managedDir, { recursive: true })
  await Promise.all(Object.entries(MANAGED_TSCONFIG_FILES).map(async ([filename, content]) => {
    const file = path.join(managedDir, filename)
    const existing = await fs.readFile(file, 'utf8').catch(() => undefined)
    if (existing == null) {
      try {
        await fs.writeFile(file, content, 'utf8')
      }
      catch (error) {
        if (error?.code !== 'ENOENT') {
          throw error
        }
        await fs.mkdir(managedDir, { recursive: true })
        await fs.writeFile(file, content, 'utf8')
      }
    }
  }))
}

async function findWorkspaceProjectRoots() {
  const roots = []

  await Promise.all(WORKSPACE_PROJECT_DIRS.map(async (relativeDir) => {
    const dir = path.resolve(ROOT_DIR, relativeDir)
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.tmp-')) {
        roots.push(path.join(dir, entry.name))
      }
    }
  }))

  return roots
}

async function syncWorkspaceManagedTsconfigBootstrapFiles() {
  const roots = await findWorkspaceProjectRoots()
  await Promise.all(roots.map(root => syncManagedTsconfigBootstrapFiles(root)))
}

async function syncHomeManagedTsconfigBootstrapFiles() {
  const homeDir = os.homedir()
  if (!homeDir || path.resolve(homeDir) === ROOT_DIR) {
    return
  }

  await syncManagedTsconfigBootstrapFiles(homeDir)
}

export default async function setup() {
  await fs.mkdir(path.resolve(ROOT_DIR, 'coverage/.tmp'), { recursive: true })
  await cleanupFixtureProjects()
  await syncWorkspaceManagedTsconfigBootstrapFiles()
  await syncHomeManagedTsconfigBootstrapFiles()
  await ensureExternalProjectPackageLinks()
}
