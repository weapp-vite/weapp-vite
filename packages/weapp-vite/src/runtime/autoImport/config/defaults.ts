import type { MutableCompilerContext } from '../../../context'
import type { AutoImportComponents } from '../../../types'
import { normalizeRoot } from '../../../utils/path'
import { cloneAutoImportComponents, mergeAutoImportComponents } from './merge'

function addDefaultComponentGlobs(
  globs: Set<string>,
  configService: NonNullable<MutableCompilerContext['configService']>,
  extension: 'vue' | 'wxml',
) {
  globs.add(`components/**/*.${extension}`)
  const subPackages = configService.weappViteConfig?.subPackages
  if (!subPackages) {
    return
  }

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
    globs.add(`${normalized}/components/**/*.${extension}`)
  }
}

function createDefaultAutoImportComponents(
  configService: NonNullable<MutableCompilerContext['configService']>,
): AutoImportComponents | undefined {
  const globs = new Set<string>()
  addDefaultComponentGlobs(globs, configService, 'wxml')
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

  const globs = new Set(defaults.globs ?? [])
  if (hasWevuDependency(configService)) {
    addDefaultComponentGlobs(globs, configService, 'vue')
  }

  return {
    ...defaults,
    globs: [...globs],
    output: true,
    typedComponents: true,
    htmlCustomData: true,
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
  const enabledDefaults = createEnabledAutoImportComponents(configService)
  const hasMergeableSubPackageAutoImportConfig = Boolean(
    Object.values(weappConfig.subPackages ?? {}).some((subConfig) => {
      const scoped = subConfig?.autoImportComponents
      return scoped !== undefined && scoped !== false
    }),
  )
  if (userConfigured === false) {
    return undefined
  }
  const normalizedConfig = userConfigured === true
    ? enabledDefaults
    : userConfigured
      ? mergeAutoImportComponents(enabledDefaults, cloneAutoImportComponents(userConfigured), true)
      : undefined
  const fallbackConfig = normalizedConfig === undefined
    && !hasMergeableSubPackageAutoImportConfig
    ? enabledDefaults
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
