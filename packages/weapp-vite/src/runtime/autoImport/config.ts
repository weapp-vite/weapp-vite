import type { MutableCompilerContext } from '../../context'
import type { AutoImportComponents, AutoImportComponentsOption } from '../../types'
import path from 'pathe'
import { toPosixPath } from '../../utils/path'

export const DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME = 'auto-import-components.json'

function resolveBaseDir(configService: NonNullable<MutableCompilerContext['configService']>) {
  const configFilePath = configService.configFilePath
  if (configFilePath) {
    return path.dirname(configFilePath)
  }
  return configService.cwd
}

function cloneAutoImportComponents(config?: AutoImportComponentsOption | null): AutoImportComponents | undefined {
  if (config === false || !config) {
    return undefined
  }

  const cloned: AutoImportComponents = {}
  if (config.globs?.length) {
    cloned.globs = [...config.globs]
  }
  if (config.resolvers?.length) {
    cloned.resolvers = [...config.resolvers]
  }
  if (config.output !== undefined) {
    cloned.output = config.output
  }
  if (config.typedComponents !== undefined) {
    cloned.typedComponents = config.typedComponents
  }
  if (config.htmlCustomData !== undefined) {
    cloned.htmlCustomData = config.htmlCustomData
  }
  return cloned
}

function mergeGlobs(base?: string[], extra?: string[]) {
  const values = [
    ...(base ?? []),
    ...(extra ?? []),
  ]
    .map(entry => entry?.trim())
    .filter((entry): entry is string => Boolean(entry))

  if (!values.length) {
    return undefined
  }
  const deduped: string[] = []
  const seen = new Set<string>()
  for (const entry of values) {
    if (seen.has(entry)) {
      continue
    }
    seen.add(entry)
    deduped.push(entry)
  }
  return deduped
}

function mergeResolvers(
  base?: AutoImportComponents['resolvers'],
  extra?: AutoImportComponents['resolvers'],
) {
  const merged = [
    ...(base ?? []),
    ...(extra ?? []),
  ].filter(Boolean)
  return merged.length ? merged : undefined
}

function mergeAutoImportComponents(
  lower?: AutoImportComponents,
  upper?: AutoImportComponents,
  preferUpperScalars = false,
): AutoImportComponents | undefined {
  if (!lower && !upper) {
    return undefined
  }
  if (!lower) {
    return cloneAutoImportComponents(upper)
  }
  if (!upper) {
    return cloneAutoImportComponents(lower)
  }

  const merged: AutoImportComponents = {}
  const globs = mergeGlobs(lower.globs, upper.globs)
  if (globs) {
    merged.globs = globs
  }
  const resolvers = mergeResolvers(lower.resolvers, upper.resolvers)
  if (resolvers) {
    merged.resolvers = resolvers
  }

  const pickScalar = <T>(baseline: T | undefined, candidate: T | undefined) => {
    return preferUpperScalars ? (candidate ?? baseline) : (baseline ?? candidate)
  }

  const output = pickScalar(lower.output, upper.output)
  if (output !== undefined) {
    merged.output = output
  }
  const typedComponents = pickScalar(lower.typedComponents, upper.typedComponents)
  if (typedComponents !== undefined) {
    merged.typedComponents = typedComponents
  }
  const htmlCustomData = pickScalar(lower.htmlCustomData, upper.htmlCustomData)
  if (htmlCustomData !== undefined) {
    merged.htmlCustomData = htmlCustomData
  }
  return merged
}

function normalizeGlobRoot(root: string) {
  return toPosixPath(root).replace(/^\/+|\/+$/g, '')
}

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
      const normalized = normalizeGlobRoot(root)
      if (!normalized) {
        continue
      }
      globs.add(`${normalized}/components/**/*.wxml`)
    }
  }
  return globs.size ? { globs: Array.from(globs) } as AutoImportComponents : undefined
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
  const fallbackConfig = userConfigured === undefined
    ? createDefaultAutoImportComponents(configService)
    : undefined
  const baseConfig = cloneAutoImportComponents(userConfigured ?? fallbackConfig)
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

export function resolveManifestOutputPath(
  configService?: MutableCompilerContext['configService'],
  manifestFileName = DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME,
) {
  if (!configService) {
    return undefined
  }

  const autoImportConfig = getAutoImportConfig(configService)
  if (!autoImportConfig) {
    return undefined
  }

  const baseDir = resolveBaseDir(configService)
  const outputOption = autoImportConfig.output
  if (outputOption === false) {
    return undefined
  }

  if (typeof outputOption === 'string' && outputOption.length > 0) {
    return path.isAbsolute(outputOption) ? outputOption : path.resolve(baseDir, outputOption)
  }

  return path.resolve(baseDir, manifestFileName)
}

function resolveTypedComponentsDefaultPath(configService: NonNullable<MutableCompilerContext['configService']>) {
  return path.resolve(resolveBaseDir(configService), 'typed-components.d.ts')
}

function resolveHtmlCustomDataDefaultPath(configService: NonNullable<MutableCompilerContext['configService']>) {
  return path.resolve(resolveBaseDir(configService), 'mini-program.html-data.json')
}

export interface TypedComponentsSettings {
  enabled: boolean
  outputPath?: string
}

export function getTypedComponentsSettings(ctx: MutableCompilerContext): TypedComponentsSettings {
  const configService = ctx.configService
  if (!configService) {
    return { enabled: false }
  }

  const autoImportConfig = getAutoImportConfig(configService)
  const option = autoImportConfig?.typedComponents

  if (option === true) {
    return {
      enabled: true,
      outputPath: resolveTypedComponentsDefaultPath(configService),
    }
  }

  if (typeof option === 'string') {
    const trimmed = option.trim()
    if (!trimmed) {
      return { enabled: false }
    }
    const baseDir = resolveBaseDir(configService)
    const resolved = path.isAbsolute(trimmed)
      ? trimmed
      : path.resolve(baseDir, trimmed)
    return {
      enabled: true,
      outputPath: resolved,
    }
  }

  return { enabled: false }
}

export interface HtmlCustomDataSettings {
  enabled: boolean
  outputPath?: string
}

export function getHtmlCustomDataSettings(ctx: MutableCompilerContext): HtmlCustomDataSettings {
  const configService = ctx.configService
  if (!configService) {
    return { enabled: false }
  }

  const autoImportConfig = getAutoImportConfig(configService)
  const option = autoImportConfig?.htmlCustomData

  if (option === true) {
    return {
      enabled: true,
      outputPath: resolveHtmlCustomDataDefaultPath(configService),
    }
  }

  if (typeof option === 'string') {
    const trimmed = option.trim()
    if (!trimmed) {
      return { enabled: false }
    }
    const baseDir = resolveBaseDir(configService)
    const resolved = path.isAbsolute(trimmed)
      ? trimmed
      : path.resolve(baseDir, trimmed)
    return {
      enabled: true,
      outputPath: resolved,
    }
  }

  return { enabled: false }
}
