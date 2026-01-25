import { configExtensions, supportedCssLangs, templateExtensions } from '../../../constants'
import { normalizePath } from '../../../utils/path'

export const watchedCssExts = new Set(supportedCssLangs.map(ext => `.${ext}`))
export const watchedTemplateExts = new Set(templateExtensions.map(ext => `.${ext}`))
export const configSuffixes = configExtensions.map(ext => `.${ext}`)
export const sidecarSuffixes = [...configSuffixes, ...watchedCssExts, ...watchedTemplateExts]
export const defaultIgnoredDirNames = new Set(['node_modules', 'miniprogram_npm', '.git', '.hg', '.svn', '.turbo', '.wevu-config'])

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
