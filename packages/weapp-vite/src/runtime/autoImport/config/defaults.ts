import type { MutableCompilerContext } from '../../../context'
import type { AutoImportComponents } from '../../../types'
import { normalizeRoot } from '../../../utils/path'
import { cloneAutoImportComponents, mergeAutoImportComponents } from './merge'

function createDefaultAutoImportComponents(
  configService: NonNullable<MutableCompilerContext['configService']>,
): AutoImportComponents | undefined {
  const globs = new Set<string>()
  globs.add('components/**/*.wxml')
  const subPackages = configService.weappViteConfig?.subPackages
  if (subPackages) {
    for (const [root, subConfig] of Object.entries(subPackages)) {
      if (!root) {
        continue
      }
      if (subConfig?.autoImportComponents === false) {
        continue
      }
      const normalized = normalizeRoot(root)
      if (!normalized) {
        continue
      }
      globs.add(`${normalized}/components/**/*.wxml`)
    }
  }
  return globs.size ? { globs: [...globs] } as AutoImportComponents : undefined
}

function hasWevuDependency(configService: NonNullable<MutableCompilerContext['configService']>) {
  const packageJson = configService.packageJson ?? {}
  return Boolean(
    packageJson.dependencies?.wevu
    || packageJson.devDependencies?.wevu
    || packageJson.peerDependencies?.wevu,
  )
}

function createEnabledAutoImportComponents(
  configService: NonNullable<MutableCompilerContext['configService']>,
): AutoImportComponents | undefined {
  const defaults = createDefaultAutoImportComponents(configService)
  if (!defaults) {
    return undefined
  }

  return {
    ...defaults,
    typedComponents: true,
    vueComponents: true,
    vueComponentsModule: hasWevuDependency(configService) ? 'wevu' : undefined,
  }
}

export function getAutoImportConfig(configService?: MutableCompilerContext['configService']): AutoImportComponents | undefined {
  if (!configService) {
    return undefined
  }

  const weappConfig = configService.weappViteConfig
  if (!weappConfig) {
    return undefined
  }

  const userConfigured = weappConfig.autoImportComponents ?? weappConfig.enhance?.autoImportComponents
  if (userConfigured === false) {
    return undefined
  }
  const normalizedConfig = userConfigured === true
    ? createEnabledAutoImportComponents(configService)
    : userConfigured
  const fallbackConfig = normalizedConfig === undefined
    ? createDefaultAutoImportComponents(configService)
    : undefined
  const baseConfig = cloneAutoImportComponents(normalizedConfig ?? fallbackConfig)
  const subPackageConfigs = weappConfig.subPackages
  const currentRoot = configService.currentSubPackageRoot

  if (currentRoot) {
    const scopedRaw = subPackageConfigs?.[currentRoot]?.autoImportComponents
    if (scopedRaw === false) {
      return undefined
    }
    const scoped = cloneAutoImportComponents(scopedRaw)
    return mergeAutoImportComponents(baseConfig, scoped, true) ?? baseConfig ?? scoped
  }

  let merged = baseConfig
  if (subPackageConfigs) {
    for (const root of Object.keys(subPackageConfigs)) {
      const scopedRaw = subPackageConfigs[root]?.autoImportComponents
      if (scopedRaw === false || !scopedRaw) {
        continue
      }
      const scoped = cloneAutoImportComponents(scopedRaw)
      if (scoped) {
        merged = mergeAutoImportComponents(merged, scoped, false)
      }
    }
  }

  return merged
}
