import type { CompilerContext } from '../../../../context'
import path from 'pathe'
import { normalizeRoot, toPosixPath } from '../../../../utils/path'
import { resolveClassStyleWxsLocation } from '../compiler/template/classStyleRuntime'

export function resolveClassStylePackageRoot(
  ctx: CompilerContext,
  relativeBase: string,
  configService: NonNullable<CompilerContext['configService']>,
) {
  const currentRoot = normalizeRoot(configService.currentSubPackageRoot ?? '')
  if (currentRoot) {
    return currentRoot
  }
  const scanService = ctx.scanService
  if (!scanService?.independentSubPackageMap?.size) {
    return ''
  }
  const normalizedBase = toPosixPath(relativeBase)
  for (const root of scanService.independentSubPackageMap.keys()) {
    const normalizedRoot = normalizeRoot(root)
    if (!normalizedRoot) {
      continue
    }
    if (normalizedBase === normalizedRoot || normalizedBase.startsWith(`${normalizedRoot}/`)) {
      return normalizedRoot
    }
  }
  return ''
}

export function resolveClassStyleWxsLocationForBase(
  ctx: CompilerContext,
  relativeBase: string,
  extension: string,
  configService: NonNullable<CompilerContext['configService']>,
) {
  const classStyleWxsShared = configService.weappViteConfig?.vue?.template?.classStyleWxsShared ?? true
  const packageRoot = classStyleWxsShared
    ? resolveClassStylePackageRoot(ctx, relativeBase, configService)
    : (() => {
        const dir = path.posix.dirname(toPosixPath(relativeBase))
        return dir === '.' ? '' : dir
      })()
  return resolveClassStyleWxsLocation({ relativeBase, extension, packageRoot })
}
