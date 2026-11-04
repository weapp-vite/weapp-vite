import type { MpPlatform } from '../../../types'
import { getMiniProgramNativeScriptModules } from '@weapp-core/shared'
import { configExtensions, supportedCssLangs, templateExtensions } from '../../../constants'
import { normalizePath } from '../../../utils/path'

export const watchedCssSuffixes = supportedCssLangs.map(ext => `.${ext}`)
export const watchedTemplateSuffixes = templateExtensions.map(ext => `.${ext}`)
export const watchedCssExts = new Set(watchedCssSuffixes)
export const watchedTemplateExts = new Set(watchedTemplateSuffixes)
export const watchedScriptModuleSuffixes = ['.wxs', '.sjs', '.wxs.ts', '.wxs.js', '.sjs.ts', '.sjs.js']
export const watchedScriptModuleExts = new Set(watchedScriptModuleSuffixes)
export const configSuffixes = configExtensions.map(ext => `.${ext}`)
export const sidecarSuffixes = [...configSuffixes, ...watchedCssSuffixes, ...watchedTemplateSuffixes, ...watchedScriptModuleSuffixes]
export const defaultIgnoredDirNames = new Set(['node_modules', 'miniprogram_npm', '.git', '.hg', '.svn', '.turbo', '.weapp-vite'])
const scriptModuleSuffixes = new Map<MpPlatform | undefined, readonly string[]>()

const watchLimitErrorCodes = new Set(['EMFILE', 'ENOSPC'])

export function getWatchedScriptModuleSuffixes(platform?: MpPlatform) {
  let suffixes = scriptModuleSuffixes.get(platform)
  if (!suffixes) {
    suffixes = [...watchedScriptModuleSuffixes, ...getMiniProgramNativeScriptModules(platform).map(module => `.${module.extension}`)]
    scriptModuleSuffixes.set(platform, suffixes)
  }
  return suffixes
}

export function isSidecarFile(filePath: string, platform?: MpPlatform) {
  return sidecarSuffixes.some(suffix => filePath.endsWith(suffix))
    || getWatchedScriptModuleSuffixes(platform).some(suffix => filePath.endsWith(suffix))
}

export function isWatchLimitError(error: unknown): error is NodeJS.ErrnoException {
  if (!error || typeof error !== 'object') {
    return false
  }
  const maybeError = error as NodeJS.ErrnoException
  if (!maybeError.code) {
    return false
  }
  return watchLimitErrorCodes.has(maybeError.code)
}

export { normalizePath }
