import type { CompilerAppShell, VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import type { ConfigService } from '../../../runtime/config/types'
import { WEVU_APP_SHELL_COMPONENT_BASE, WEVU_APP_SHELL_TAG_NAME } from '@weapp-core/constants'
import path from 'pathe'
import { normalizeWatchPath, toPosixPath } from '../../../utils/path'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../utils/vueSfc'

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

export function resolveAppShellLayout(configService: Pick<ConfigService, 'absoluteSrcRoot' | 'relativeOutputPath'>): ResolvedAppShell | undefined {
  const importPath = resolveAppShellImportPath(configService)
  if (!importPath) {
    return undefined
  }

  return {
    file: normalizeWatchPath(resolveAppShellBase(configService)),
    importPath,
    tagName: WEVU_APP_SHELL_TAG_NAME,
  }
}

/**
 * 将应用壳信息投影为编译器可序列化输入。
 */
export function toCompilerAppShell(appShell: ResolvedAppShell | undefined): CompilerAppShell | undefined {
  if (!appShell) {
    return undefined
  }
  return {
    importPath: appShell.importPath,
    tagName: appShell.tagName,
  }
}

/**
 * 生成应用壳编译输入的稳定签名。
 */
export function createCompilerAppShellSignature(appShell: ResolvedAppShell | undefined) {
  return JSON.stringify(toCompilerAppShell(appShell) ?? null)
}

/**
 * 在页面编译前解析应用入口是否拥有模板应用壳。
 */
export async function resolveAppShellForCompilation(
  ctx: Pick<CompilerContext, 'configService' | 'scanService'>,
  pluginCtx: Parameters<typeof createReadAndParseSfcOptions>[0],
) {
  const configService = ctx.configService
  const scanService = ctx.scanService
  if (!configService || !scanService || configService.weappLibConfig?.enabled) {
    return undefined
  }

  const appEntry = await scanService.loadAppEntry()
  if (!isAppVueFile(appEntry.path)) {
    return undefined
  }

  const { descriptor } = await readAndParseSfc(
    appEntry.path,
    createReadAndParseSfcOptions(pluginCtx, configService),
  )
  if (!descriptor.template?.content.trim()) {
    return undefined
  }
  return resolveAppShellLayout(configService)
}
