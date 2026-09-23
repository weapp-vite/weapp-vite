import { existsSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'pathe'
import logger from '../logger'
import { safeGetPackageInfoSync } from './localPkg'

export interface BuiltinPackageAliasEntry {
  find: string
  replacement: string
}

export type WevuRuntimeAliasMode = 'auto' | 'dev' | 'build'

export interface ResolveBuiltinPackageAliasesOptions {
  cwd?: string
  isDev?: boolean
  wevuRuntime?: WevuRuntimeAliasMode
}

interface PackageAliasTarget {
  find: string
  packageName: string
  distEntry: string
  devDistEntry?: string
  fallbackWorkspacePackagePath?: string
}

const WEVU_WORKSPACE_PACKAGE_PATH = 'packages-runtime/wevu'
const SHARED_WORKSPACE_PACKAGE_PATH = '@weapp-core/shared'
const PACKAGE_ALIAS_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const warnedWevuVersionMismatches = new Set<string>()

function packageResolutionPath(fromDir: string) {
  return path.join(fromDir, '.weapp-vite-package-resolution.mjs')
}

const PACKAGE_ALIASES: PackageAliasTarget[] = [
  {
    find: '@weapp-core/shared/platforms',
    packageName: '@weapp-core/shared',
    distEntry: 'dist/platforms/index.js',
    fallbackWorkspacePackagePath: SHARED_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: '@weapp-core/shared/platforms/runtime',
    packageName: '@weapp-core/shared',
    distEntry: 'dist/platforms/runtime/index.js',
    fallbackWorkspacePackagePath: SHARED_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'class-variance-authority',
    packageName: 'class-variance-authority',
    distEntry: 'dist/index.js',
  },
  {
    find: 'wevu',
    packageName: 'wevu',
    distEntry: 'dist/index.mjs',
    devDistEntry: 'dist/dev/index.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/compiler',
    packageName: 'wevu',
    distEntry: 'dist/compiler.mjs',
    devDistEntry: 'dist/dev/compiler.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/internal-runtime',
    packageName: 'wevu',
    distEntry: 'dist/internal-runtime.mjs',
    devDistEntry: 'dist/dev/internal-runtime.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/internal-reactivity',
    packageName: 'wevu',
    distEntry: 'dist/internal-reactivity.mjs',
    devDistEntry: 'dist/dev/internal-reactivity.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/internal-template',
    packageName: 'wevu',
    distEntry: 'dist/internal-template.mjs',
    devDistEntry: 'dist/dev/internal-template.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/store',
    packageName: 'wevu',
    distEntry: 'dist/store.mjs',
    devDistEntry: 'dist/dev/store.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/api',
    packageName: 'wevu',
    distEntry: 'dist/api.mjs',
    devDistEntry: 'dist/dev/api.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/fetch',
    packageName: 'wevu',
    distEntry: 'dist/fetch.mjs',
    devDistEntry: 'dist/dev/fetch.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/web-apis',
    packageName: 'wevu',
    distEntry: 'dist/web-apis.mjs',
    devDistEntry: 'dist/dev/web-apis.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/router',
    packageName: 'wevu',
    distEntry: 'dist/router.mjs',
    devDistEntry: 'dist/dev/router.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'vue-demi',
    packageName: 'wevu',
    distEntry: 'dist/vue-demi.mjs',
    devDistEntry: 'dist/dev/vue-demi.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
]

function resolveWevuRuntimeDistEntries(
  target: PackageAliasTarget,
  options: ResolveBuiltinPackageAliasesOptions,
) {
  if (!target.devDistEntry || target.packageName !== 'wevu') {
    return [target.distEntry]
  }
  const mode = options.wevuRuntime ?? 'auto'
  if (mode === 'dev' || (mode === 'auto' && options.isDev)) {
    return [target.devDistEntry]
  }
  return [target.distEntry]
}

function resolveRepoRoot(fromDir: string) {
  let currentDir = fromDir
  while (true) {
    if (existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir
    }
    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return undefined
    }
    currentDir = parentDir
  }
}

function resolvePackageEntry(
  packageName: string,
  distEntries: string[],
  fallbackWorkspacePackagePath?: string,
  cwd?: string,
  packageRoot?: string,
) {
  const packageInfo = packageRoot
    ? { rootPath: packageRoot }
    : safeGetPackageInfoSync(packageName, cwd ? { paths: [packageResolutionPath(cwd)] } : undefined)
  if (packageInfo) {
    for (const distEntry of distEntries) {
      const resolvedEntry = path.resolve(packageInfo.rootPath, distEntry)
      if (existsSync(resolvedEntry)) {
        return resolvedEntry
      }
    }
  }

  if (!fallbackWorkspacePackagePath) {
    return undefined
  }

  const fallbackRoots = new Set([
    cwd,
    PACKAGE_ALIAS_MODULE_DIR,
  ].filter((value): value is string => Boolean(value)))
  for (const fromDir of fallbackRoots) {
    const repoRoot = resolveRepoRoot(fromDir)
    if (!repoRoot) {
      continue
    }
    for (const distEntry of distEntries) {
      const fallbackEntry = path.resolve(repoRoot, fallbackWorkspacePackagePath, distEntry)
      if (existsSync(fallbackEntry)) {
        return fallbackEntry
      }
    }
  }

  return undefined
}

function resolveWeappVitePackage(cwd?: string) {
  const searchPaths = [PACKAGE_ALIAS_MODULE_DIR, cwd].filter((value): value is string => Boolean(value))
  for (const searchPath of searchPaths) {
    const packageInfo = safeGetPackageInfoSync('weapp-vite', {
      paths: [packageResolutionPath(searchPath)],
    })
    if (packageInfo) {
      return packageInfo
    }
  }
  return undefined
}

interface ResolvedWevuPackage {
  rootPath: string
  version?: string
}

function resolveBundledWevu(cwd?: string): ResolvedWevuPackage | undefined {
  const weappVitePackage = resolveWeappVitePackage(cwd)
  const dependencyVersion = weappVitePackage?.packageJson.dependencies?.wevu
  if (!weappVitePackage || !dependencyVersion) {
    return undefined
  }

  // 从 weapp-vite 自身的依赖边界解析。pnpm 会把依赖放在虚拟 store 的 sibling
  // 目录中，而不是 `${rootPath}/node_modules`，因此不能用物理 nested 路径作为门禁。
  const bundledWevu = safeGetPackageInfoSync('wevu', {
    paths: [packageResolutionPath(weappVitePackage.rootPath)],
  })
  if (!bundledWevu?.version) {
    return undefined
  }
  // 构建器和运行时可独立发版，发布包的精确版本依赖才是兼容性依据。
  return dependencyVersion === 'workspace:*' || bundledWevu.version === dependencyVersion
    ? bundledWevu
    : undefined
}

function warnWevuVersionMismatch(cwd: string | undefined, bundledWevu: ResolvedWevuPackage | undefined) {
  if (!bundledWevu) {
    return
  }

  const projectWevu = safeGetPackageInfoSync('wevu', cwd ? { paths: [packageResolutionPath(cwd)] } : undefined)
  if (!projectWevu?.version || !bundledWevu?.version || projectWevu.version === bundledWevu.version) {
    return
  }

  const warningKey = `${cwd ?? process.cwd()}\0${projectWevu.version}\0${bundledWevu.version}`
  if (warnedWevuVersionMismatches.has(warningKey)) {
    return
  }
  warnedWevuVersionMismatches.add(warningKey)
  logger.warn(`[weapp-vite] 检测到项目解析到 wevu@${projectWevu.version}，与 weapp-vite 配套的 wevu@${bundledWevu.version} 不一致，已自动采用兼容副本。建议执行 pnpm update weapp-vite wevu。`)
}

export function resolveBuiltinPackageAliases(options: ResolveBuiltinPackageAliasesOptions = {}): BuiltinPackageAliasEntry[] {
  const aliases: BuiltinPackageAliasEntry[] = []
  const bundledWevu = resolveBundledWevu(options.cwd)
  warnWevuVersionMismatch(options.cwd, bundledWevu)

  for (const target of PACKAGE_ALIASES) {
    const { find, packageName, fallbackWorkspacePackagePath } = target
    const distEntries = resolveWevuRuntimeDistEntries(target, options)
    const resolvedEntry = packageName === 'wevu' && bundledWevu
      ? resolvePackageEntry(packageName, distEntries, undefined, options.cwd, bundledWevu.rootPath)
      : resolvePackageEntry(packageName, distEntries, fallbackWorkspacePackagePath, options.cwd)
    if (!resolvedEntry) {
      continue
    }
    aliases.push({
      find,
      replacement: resolvedEntry,
    })
  }

  return aliases
}
