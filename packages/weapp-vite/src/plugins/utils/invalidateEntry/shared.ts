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

const watchLimitErrorCodes = new Set(['EMFILE', 'ENOSPC'])

export function isSidecarFile(filePath: string) {
  return sidecarSuffixes.some(suffix => filePath.endsWith(suffix))
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
