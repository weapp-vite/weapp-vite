import type { PackageJson } from 'pkg-types'
import type { MutableCompilerContext } from '../../../context'
import { getPackageInfoSync } from 'local-pkg'
import { getPlatformNpmDistDirName, resolveMiniPlatformWithDefault } from '../../../platform'

const DEFAULT_NPM_STRATEGY = 'explicit'

function dedupeDependencies(dependencies: string[]) {
  return [...new Set(dependencies)]
}

function matchDependencyName(patterns: (string | RegExp)[], dep: string) {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return pattern === dep
    }

    pattern.lastIndex = 0
    return pattern.test(dep)
  })
}

function createDependencyRecord(dependencies: string[]) {
  if (dependencies.length === 0) {
    return undefined
  }

  return Object.fromEntries(
    dependencies.map(dep => [dep, '*']),
  ) as Record<string, string>
}

function resolveNpmStrategy(ctx: MutableCompilerContext) {
  return ctx.configService?.weappViteConfig?.npm?.strategy ?? DEFAULT_NPM_STRATEGY
}

function resolveConfiguredDependencyPatterns(ctx: MutableCompilerContext) {
  const npmConfig = ctx.configService?.weappViteConfig?.npm
  const patterns: (string | RegExp)[] = [...npmConfig?.include ?? []]

  if (ctx.configService?.pluginOnly) {
    if (Array.isArray(npmConfig?.pluginPackage?.dependencies)) {
      patterns.push(...npmConfig.pluginPackage.dependencies)
    }
    return patterns
  }

  if (Array.isArray(npmConfig?.mainPackage?.dependencies)) {
    patterns.push(...npmConfig.mainPackage.dependencies)
  }

  for (const config of Object.values((npmConfig?.subPackages ?? {}) as Record<string, { dependencies?: (string | RegExp)[] } | undefined>)) {
    if (Array.isArray(config?.dependencies)) {
      patterns.push(...config.dependencies)
    }
  }

  return patterns
}

function resolveDeclaredDependencies(pkgJson: PackageJson) {
  return dedupeDependencies([
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.devDependencies ?? {}),
  ])
}

function isMiniprogramPackage(pkg: PackageJson) {
  return Reflect.has(pkg, 'miniprogram') && typeof pkg.miniprogram === 'string'
}

function resolveMiniprogramCandidateDependenciesSync(
  allDependencies: string[],
  cwd?: string,
) {
  return allDependencies.filter((dep) => {
    let packageInfo: ReturnType<typeof getPackageInfoSync> | null = null
    try {
      packageInfo = getPackageInfoSync(dep, cwd ? { paths: [cwd] } : undefined)
    }
    catch {
      packageInfo = null
    }
    return !!packageInfo && isMiniprogramPackage(packageInfo.packageJson)
  })
}

function resolveMainPackageDependencyPatterns(ctx: MutableCompilerContext) {
  return ctx.configService?.weappViteConfig?.npm?.mainPackage?.dependencies
}

function resolvePluginPackageDependencyPatterns(ctx: MutableCompilerContext) {
  return ctx.configService?.weappViteConfig?.npm?.pluginPackage?.dependencies
}

export function resolveTargetDependencies(
  allDependencies: string[],
  patterns?: false | (string | RegExp)[],
) {
  if (patterns === false) {
    return []
  }

  if (!Array.isArray(patterns)) {
    return allDependencies
  }

  const selected = new Set<string>()
  for (const dep of allDependencies) {
    if (matchDependencyName(patterns, dep)) {
      selected.add(dep)
    }
  }

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      selected.add(pattern)
    }
  }

  return [...selected]
}

export function resolveNpmBuildCandidateDependenciesSync(
  ctx: MutableCompilerContext,
  pkgJson: PackageJson,
) {
  if (resolveNpmStrategy(ctx) === 'legacy') {
    return Object.keys(pkgJson.dependencies ?? {})
  }

  const declaredDependencies = resolveDeclaredDependencies(pkgJson)
  const configuredPatterns = resolveConfiguredDependencyPatterns(ctx)
  const explicitlyIncludedDependencies = resolveTargetDependencies(declaredDependencies, configuredPatterns)
  const miniprogramDependencies = resolveMiniprogramCandidateDependenciesSync(
    declaredDependencies,
    ctx.configService?.cwd,
  )

  return dedupeDependencies([
    ...miniprogramDependencies,
    ...explicitlyIncludedDependencies,
  ])
}

export function resolveNpmBuildCandidateDependencyRecordSync(
  ctx: MutableCompilerContext,
  pkgJson?: PackageJson,
) {
  if (!pkgJson) {
    return undefined
  }
  return createDependencyRecord(resolveNpmBuildCandidateDependenciesSync(ctx, pkgJson))
}

export function hasLocalSubPackageNpmConfig(ctx: MutableCompilerContext) {
  const npmSubPackages = ctx.configService?.weappViteConfig?.npm?.subPackages
  if (npmSubPackages && Object.values(npmSubPackages as Record<string, { dependencies?: (string | RegExp)[] } | undefined>).some(config => Array.isArray(config?.dependencies) && config.dependencies.length > 0)) {
    return true
  }
  return false
}

export function resolveNpmDistDirName(configService?: MutableCompilerContext['configService']) {
  return getPlatformNpmDistDirName(resolveMiniPlatformWithDefault(configService?.platform), {
    alipayNpmMode: configService?.weappViteConfig?.npm?.alipayNpmMode,
  })
}

export function resolveMainBuildDependencyPatterns(ctx: MutableCompilerContext) {
  return ctx.configService?.pluginOnly
    ? resolvePluginPackageDependencyPatterns(ctx)
    : resolveMainPackageDependencyPatterns(ctx)
}

export function dedupeNpmDependencies(dependencies: string[]) {
  return dedupeDependencies(dependencies)
}

export function resolveConfiguredNpmDependencyPatterns(ctx: MutableCompilerContext) {
  return resolveConfiguredDependencyPatterns(ctx)
}

export function resolveDeclaredNpmDependencies(pkgJson: PackageJson) {
  return resolveDeclaredDependencies(pkgJson)
}

export function resolveNpmStrategyMode(ctx: MutableCompilerContext) {
  return resolveNpmStrategy(ctx)
}
