import type { MutableCompilerContext } from '../../context'
import path from 'pathe'

export const DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME = 'auto-import-components.json'

function resolveBaseDir(configService: NonNullable<MutableCompilerContext['configService']>) {
  const configFilePath = configService.configFilePath
  if (configFilePath) {
    return path.dirname(configFilePath)
  }
  return configService.cwd
}

export function getAutoImportConfig(configService?: MutableCompilerContext['configService']) {
  const weappConfig = configService?.weappViteConfig
  return weappConfig?.autoImportComponents ?? weappConfig?.enhance?.autoImportComponents
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
