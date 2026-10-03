import type { LoadConfigOptions } from '../src/context'
import { existsSync } from 'node:fs'
import { cp, lstat, mkdir, mkdtemp, readlink, realpath, rm, symlink } from 'node:fs/promises'
import { fdir } from 'fdir'
import path from 'pathe'
import { rebaseTempConfigExtends } from '../../../scripts/testFixtures/configExtends'
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

const REGION_PREFIX = '//#region '
const FIXTURE_REGION_MARKER = 'test/fixture-projects/weapp-vite/'
const VITE_CSS_MARKER_RE = /\/\*\$vite\$:\d+\*\//g

export function normalizeFixtureRegionPaths(content: string) {
  return content
    .split('\n')
    .map((line) => {
      if (!line.startsWith(REGION_PREFIX)) {
        return line
      }
      const normalizedSource = line.slice(REGION_PREFIX.length).replaceAll('\\', '/')
      const markerIndex = normalizedSource.indexOf(FIXTURE_REGION_MARKER)
      if (markerIndex < 0) {
        return line
      }
      return `//#region ${normalizedSource.slice(markerIndex)}`
    })
    .join('\n')
}

export function normalizeBuildOutputContent(content: string) {
  return normalizeFixtureRegionPaths(content).replace(VITE_CSS_MARKER_RE, '')
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
  if (packageName !== 'weapp-vite') {
    return
  }

  const requestedNodeModulesDir = path.join(projectRoot, 'node_modules')
  await mkdir(requestedNodeModulesDir, { recursive: true })
  // fixture 可能复用 node_modules 或项目目录链接；相对目标必须基于链接实际所在目录解析。
  const projectNodeModulesDir = await realpath(requestedNodeModulesDir)
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

  await symlink(path.relative(projectNodeModulesDir, workspaceWeappViteDir), packageRoot, 'junction')
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

  await rebaseTempConfigExtends(fixtureSource, tempDir)
  await ensureWorkspacePackageLink(tempDir)

  return {
    tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
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
