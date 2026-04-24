import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'pathe'
import { safeGetPackageInfoSync } from './localPkg'

export interface BuiltinPackageAliasEntry {
  find: string
  replacement: string
}

interface PackageAliasTarget {
  find: string
  packageName: string
  distEntry: string
  fallbackWorkspacePackagePath?: string
}

const WEVU_WORKSPACE_PACKAGE_PATH = 'packages-runtime/wevu'

const PACKAGE_ALIASES: PackageAliasTarget[] = [
  {
    find: 'class-variance-authority',
    packageName: 'class-variance-authority',
    distEntry: 'dist/index.js',
  },
  {
    find: 'wevu',
    packageName: 'wevu',
    distEntry: 'dist/index.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/compiler',
    packageName: 'wevu',
    distEntry: 'dist/compiler.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/jsx-runtime',
    packageName: 'wevu',
    distEntry: 'dist/jsx-runtime.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/store',
    packageName: 'wevu',
    distEntry: 'dist/store.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/api',
    packageName: 'wevu',
    distEntry: 'dist/api.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/fetch',
    packageName: 'wevu',
    distEntry: 'dist/fetch.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/web-apis',
    packageName: 'wevu',
    distEntry: 'dist/web-apis.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'wevu/router',
    packageName: 'wevu',
    distEntry: 'dist/router.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
  {
    find: 'vue-demi',
    packageName: 'wevu',
    distEntry: 'dist/vue-demi.mjs',
    fallbackWorkspacePackagePath: WEVU_WORKSPACE_PACKAGE_PATH,
  },
]

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
  distEntry: string,
  fallbackWorkspacePackagePath?: string,
) {
  const packageInfo = safeGetPackageInfoSync(packageName)
  if (packageInfo) {
    const resolvedEntry = path.resolve(packageInfo.rootPath, distEntry)
    if (existsSync(resolvedEntry)) {
      return resolvedEntry
    }
  }

  if (!fallbackWorkspacePackagePath) {
    return undefined
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolveRepoRoot(currentDir)
  if (!repoRoot) {
    return undefined
  }

  const fallbackEntry = path.resolve(repoRoot, fallbackWorkspacePackagePath, distEntry)
  if (existsSync(fallbackEntry)) {
    return fallbackEntry
  }

  return undefined
}

export function resolveBuiltinPackageAliases(): BuiltinPackageAliasEntry[] {
  const aliases: BuiltinPackageAliasEntry[] = []

  for (const { find, packageName, distEntry, fallbackWorkspacePackagePath } of PACKAGE_ALIASES) {
    const resolvedEntry = resolvePackageEntry(packageName, distEntry, fallbackWorkspacePackagePath)
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
