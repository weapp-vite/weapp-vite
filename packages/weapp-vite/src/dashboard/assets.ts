import fs from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'
import path from 'pathe'

export const ANALYZE_DASHBOARD_PACKAGE_NAME = '@weapp-vite/dashboard'
const require = createRequire(import.meta.url)

interface DashboardPackageManifest {
  weappViteDashboard?: {
    devConfigFile?: string
    devRoot?: string
    distDir?: string
  }
}

interface ResolvedDashboardRoot {
  root: string
  configFile?: string
}

function parseDashboardManifest(source: string): DashboardPackageManifest | undefined {
  const parsed: unknown = JSON.parse(source)
  const metadata = parsed && typeof parsed === 'object' && 'weappViteDashboard' in parsed
    ? parsed.weappViteDashboard
    : undefined
  if (!metadata || typeof metadata !== 'object') {
    return undefined
  }
  return {
    weappViteDashboard: {
      devConfigFile: 'devConfigFile' in metadata && typeof metadata.devConfigFile === 'string' ? metadata.devConfigFile : undefined,
      devRoot: 'devRoot' in metadata && typeof metadata.devRoot === 'string' ? metadata.devRoot : undefined,
      distDir: 'distDir' in metadata && typeof metadata.distDir === 'string' ? metadata.distDir : undefined,
    },
  }
}

function resolveDashboardPackage(cwd?: string) {
  const resolvePaths = cwd && cwd !== process.cwd()
    ? [cwd, process.cwd()]
    : cwd ? [cwd] : undefined
  try {
    const packageJsonPath = require.resolve(`${ANALYZE_DASHBOARD_PACKAGE_NAME}/package.json`, { paths: resolvePaths })
    let manifest: DashboardPackageManifest | undefined
    try {
      manifest = parseDashboardManifest(fs.readFileSync(packageJsonPath, 'utf8'))
    }
    catch {
      manifest = undefined
    }
    return { root: path.dirname(packageJsonPath), manifest }
  }
  catch {
    return undefined
  }
}

function resolveDashboardDistRoot(packageRoot: string, manifest: DashboardPackageManifest | undefined): ResolvedDashboardRoot | undefined {
  const root = path.resolve(packageRoot, manifest?.weappViteDashboard?.distDir ?? 'dist')
  return fs.existsSync(path.join(root, 'index.html')) ? { root } : undefined
}

function resolveDashboardDevRoot(packageRoot: string, manifest: DashboardPackageManifest | undefined): ResolvedDashboardRoot | undefined {
  const devRoot = manifest?.weappViteDashboard?.devRoot
  const devConfigFile = manifest?.weappViteDashboard?.devConfigFile
  if (!devRoot || !devConfigFile) {
    return undefined
  }
  const root = path.resolve(packageRoot, devRoot)
  const configFile = path.resolve(root, devConfigFile)
  return fs.existsSync(root) && fs.existsSync(configFile) ? { root, configFile } : undefined
}

export function resolveDashboardRoot(options: { cwd?: string, watch?: boolean }): ResolvedDashboardRoot | undefined {
  const resolved = resolveDashboardPackage(options.cwd)
  if (!resolved) {
    return undefined
  }
  return options.watch
    ? resolveDashboardDevRoot(resolved.root, resolved.manifest) ?? resolveDashboardDistRoot(resolved.root, resolved.manifest)
    : resolveDashboardDistRoot(resolved.root, resolved.manifest) ?? resolveDashboardDevRoot(resolved.root, resolved.manifest)
}

/** 定位可选仪表盘包的原生构建 SPA；未安装或尚未构建时返回 undefined。 */
export function resolveDashboardClientAssets(cwd?: string): string | undefined {
  const resolved = resolveDashboardPackage(cwd)
  return resolved ? resolveDashboardDistRoot(resolved.root, resolved.manifest)?.root : undefined
}
