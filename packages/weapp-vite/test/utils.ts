import type { LoadConfigOptions } from '../src/context'
import { existsSync } from 'node:fs'
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink } from 'node:fs/promises'
import { fdir } from 'fdir'
import path from 'pathe'
import { resetCompilerContext } from '../src/context/getInstance'
import { createCompilerContext } from '../src/createContext'

export const appsDir = path.resolve(__dirname, '../../../apps')
export const templatesDir = path.resolve(__dirname, '../../../templates')
export const projectFixturesDir = path.resolve(__dirname, '../../../test/fixture-projects/weapp-vite')
const workspaceWeappViteDir = path.resolve(__dirname, '..')

export function getApp(app: string) {
  const appRoot = path.resolve(appsDir, app)
  const templateRoot = path.resolve(templatesDir, app)
  const appProjectConfig = path.resolve(appRoot, 'project.config.json')
  const templateProjectConfig = path.resolve(templateRoot, 'project.config.json')

  if (existsSync(appProjectConfig)) {
    return appRoot
  }
  if (existsSync(templateProjectConfig)) {
    return templateRoot
  }
  if (existsSync(appRoot)) {
    return appRoot
  }
  return templateRoot
}

export function getFixture(dir: string) {
  return path.resolve(projectFixturesDir, dir)
}

export const dirs = [
  // 'native',
  // 'native-skyline',
  // 'native-ts',
  // 'native-ts-skyline',
  'vite-native',
  'vite-native-skyline',
  'vite-native-ts',
  'vite-native-ts-skyline',
]

export const absDirs = dirs.map((x) => {
  return {
    name: x,
    path: getApp(x),
  }
})

export async function scanFiles(root: string) {
  // eslint-disable-next-line new-cap
  const fd = new fdir(
    {
      relativePaths: true,
      pathSeparator: '/',
    },
  )
  const files = (await fd.crawl(root).withPromise()).sort()
  return files
}

export function createTask() {
  const result: {
    resolve: (value: unknown) => void
    reject: (reason?: any) => void
    promise: Promise<unknown>
    reset: () => void
  } = {
    resolve: () => {},
    reject: () => {},
    promise: Promise.resolve(),
    reset: () => {
      result.promise = new Promise((_resolve, _reject) => {
        result.resolve = _resolve
        result.reject = _reject
      })
    },
  }

  result.reset()

  return result
}

let contextCounter = 0

export async function ensureWorkspacePackageLink(projectRoot: string, packageName = 'weapp-vite') {
  const projectNodeModulesDir = path.join(projectRoot, 'node_modules')
  if (packageName !== 'weapp-vite') {
    return
  }

  const packageRoot = path.join(projectNodeModulesDir, packageName)
  const existingStat = await lstat(packageRoot).catch(() => null)
  if (existingStat?.isSymbolicLink()) {
    const currentTarget = await readlink(packageRoot).catch(() => '')
    if (path.resolve(projectNodeModulesDir, currentTarget) === workspaceWeappViteDir) {
      return
    }
  }
  if (existingStat) {
    await rm(packageRoot, { recursive: true, force: true })
  }

  await mkdir(projectNodeModulesDir, { recursive: true })
  await symlink(path.relative(projectNodeModulesDir, workspaceWeappViteDir), packageRoot, 'junction')
}

const RELATIVE_CONFIG_EXTENDS_RE = /"extends"\s*:\s*"([^"]+)"/

function resolveJsonConfigPath(baseDir: string, extendsPath: string) {
  const resolved = path.resolve(baseDir, extendsPath)
  return path.extname(resolved) ? resolved : `${resolved}.json`
}

function isPathInside(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function syncExternalConfigExtends(
  sourceFile: string,
  tempFile: string,
  fixtureRoot: string,
  visited: Set<string>,
) {
  const visitKey = `${sourceFile}::${tempFile}`
  if (visited.has(visitKey) || !existsSync(sourceFile)) {
    return
  }
  visited.add(visitKey)

  const content = await readFile(sourceFile, 'utf8').catch(() => '')
  const extendsPath = content.match(RELATIVE_CONFIG_EXTENDS_RE)?.[1]
  if (!extendsPath?.startsWith('.')) {
    return
  }

  const sourceTarget = resolveJsonConfigPath(path.dirname(sourceFile), extendsPath)
  const tempTarget = resolveJsonConfigPath(path.dirname(tempFile), extendsPath)
  if (!existsSync(sourceTarget)) {
    return
  }

  if (!isPathInside(fixtureRoot, sourceTarget) && !existsSync(tempTarget)) {
    await mkdir(path.dirname(tempTarget), { recursive: true })
    await cp(sourceTarget, tempTarget, { force: true })
  }

  if (existsSync(tempTarget)) {
    await syncExternalConfigExtends(sourceTarget, tempTarget, fixtureRoot, visited)
  }
}

async function syncExternalTempConfigChain(fixtureRoot: string, tempDir: string) {
  const visited = new Set<string>()
  for (const entry of ['tsconfig.json', 'jsconfig.json']) {
    const sourceFile = path.join(fixtureRoot, entry)
    if (!existsSync(sourceFile)) {
      continue
    }
    await syncExternalConfigExtends(sourceFile, path.join(tempDir, entry), fixtureRoot, visited)
  }
}

export async function createTempFixtureProject(
  fixtureSource: string,
  prefix: string,
  extraIgnored: string[] = [],
) {
  const tempRoot = path.resolve(fixtureSource, '..', '__temp__')
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, `${prefix}-`))
  const ignored = new Set([
    '.weapp-vite',
    'dist',
    'node_modules',
    ...extraIgnored,
  ])

  await cp(fixtureSource, tempDir, {
    dereference: true,
    force: true,
    recursive: true,
    filter: (src) => {
      const relative = path.relative(fixtureSource, src).replaceAll('\\', '/')
      if (!relative) {
        return true
      }
      return !Array.from(ignored).some((entry) => {
        return relative === entry || relative.startsWith(`${entry}/`)
      })
    },
  })

  await syncExternalTempConfigChain(fixtureSource, tempDir)
  await ensureWorkspacePackageLink(tempDir)

  return {
    tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
      const remaining = await readdir(tempRoot).catch(() => null)
      if (remaining && remaining.length === 0) {
        await rm(tempRoot, { recursive: true, force: true })
      }
    },
  }
}

export async function createTestCompilerContext(
  options: Partial<LoadConfigOptions> & { key?: string } = {},
) {
  const key = options.key ?? `vitest-context-${++contextCounter}`
  if (options.cwd) {
    await ensureWorkspacePackageLink(options.cwd)
  }
  resetCompilerContext(key)
  const ctx = await createCompilerContext({ ...options, key })

  const dispose = async () => {
    try {
      ctx.watcherService?.closeAll()
    }
    finally {
      resetCompilerContext(key)
    }
  }

  return {
    ctx,
    dispose,
    key,
  }
}
