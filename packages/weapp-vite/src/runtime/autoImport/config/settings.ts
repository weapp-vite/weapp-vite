import type { MutableCompilerContext } from '../../../context'
import path from 'pathe'
import {
  resolveBaseDir,
  resolveHtmlCustomDataDefaultPath,
  resolveTypedComponentsDefaultPath,
  resolveVueComponentsDefaultPath,
} from './base'
import { getAutoImportConfig } from './defaults'

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

export interface VueComponentsSettings {
  enabled: boolean
  outputPath?: string
  moduleName?: string
}

export function getVueComponentsSettings(ctx: MutableCompilerContext): VueComponentsSettings {
  const configService = ctx.configService
  if (!configService) {
    return { enabled: false }
  }

  const autoImportConfig = getAutoImportConfig(configService)
  const option = autoImportConfig?.vueComponents
  const rawModuleName = autoImportConfig?.vueComponentsModule?.trim()
  const moduleName = rawModuleName || undefined

  if (option === true) {
    return {
      enabled: true,
      outputPath: resolveVueComponentsDefaultPath(configService),
      moduleName,
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
      moduleName,
    }
  }

  return { enabled: false }
}
