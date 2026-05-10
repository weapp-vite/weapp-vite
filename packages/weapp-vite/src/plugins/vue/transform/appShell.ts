import type { VueTransformResult } from 'wevu/compiler'
import type { ConfigService } from '../../../runtime/config/types'
import type { LayoutTransformLikeResult, ResolvedPageLayout } from './pageLayout'
import { WEVU_APP_SHELL_COMPONENT_BASE, WEVU_APP_SHELL_TAG_NAME } from '@weapp-core/constants'
import path from 'pathe'
import { normalizeWatchPath, toPosixPath } from '../../../utils/path'
import { applyPageLayout } from './pageLayout'

const APP_VUE_FILE_RE = /[\\/]app\.vue$/

export interface ResolvedAppShell {
  file: string
  importPath: string
  tagName: string
}

export function isAppVueFile(filename: string) {
  return APP_VUE_FILE_RE.test(filename)
}

export function hasAppShellTemplate(result: Pick<VueTransformResult, 'template'> | undefined) {
  return Boolean(result?.template?.trim())
}

export function resolveAppShellBase(configService: Pick<ConfigService, 'absoluteSrcRoot'>) {
  return path.join(configService.absoluteSrcRoot, WEVU_APP_SHELL_COMPONENT_BASE)
}

export function resolveAppShellRelativeBase(configService: Pick<ConfigService, 'relativeOutputPath' | 'absoluteSrcRoot'>) {
  return configService.relativeOutputPath(resolveAppShellBase(configService))
}

export function resolveAppShellImportPath(configService: Pick<ConfigService, 'relativeOutputPath' | 'absoluteSrcRoot'>) {
  const relativeBase = resolveAppShellRelativeBase(configService)
  return relativeBase ? `/${toPosixPath(relativeBase)}` : undefined
}

export function resolveAppShellLayout(configService: Pick<ConfigService, 'absoluteSrcRoot' | 'relativeOutputPath'>): ResolvedPageLayout | undefined {
  const importPath = resolveAppShellImportPath(configService)
  if (!importPath) {
    return undefined
  }

  return {
    file: normalizeWatchPath(resolveAppShellBase(configService)),
    importPath,
    kind: 'vue',
    layoutName: 'app-shell',
    tagName: WEVU_APP_SHELL_TAG_NAME,
  }
}

export function applyAppShell(
  result: LayoutTransformLikeResult,
  filename: string,
  appShell: ResolvedAppShell | undefined,
) {
  if (!appShell || !result.template) {
    return result
  }

  return applyPageLayout(result as VueTransformResult, filename, {
    file: appShell.file,
    importPath: appShell.importPath,
    kind: 'vue',
    layoutName: 'app-shell',
    tagName: appShell.tagName,
  })
}
