import type { CompilerContext } from '../../../context'

export const VUE_LIKE_EXTENSIONS = ['.vue', '.tsx', '.jsx'] as const

export function isVueLikeFile(id: string) {
  return VUE_LIKE_EXTENSIONS.some(ext => id.endsWith(ext))
}

export function stripVueLikeExtension(filePath: string) {
  for (const ext of VUE_LIKE_EXTENSIONS) {
    if (filePath.endsWith(ext)) {
      return filePath.slice(0, -ext.length)
    }
  }
  return filePath
}

export function resolveVueLikeEntryCandidates(entryId: string) {
  return VUE_LIKE_EXTENSIONS.map(ext => `${entryId}${ext}`)
}

export async function findFirstResolvedVueLikeEntry<T>(
  entryId: string,
  options: {
    resolve: (candidate: string) => Promise<T | undefined> | T | undefined
  },
) {
  for (const candidate of resolveVueLikeEntryCandidates(entryId)) {
    const resolved = await options.resolve(candidate)
    if (resolved !== undefined) {
      return resolved
    }
  }
  return undefined
}

export function resolveVueOutputBase(
  configService: Pick<NonNullable<CompilerContext['configService']>, 'relativeOutputPath'>,
  filePath: string,
) {
  const extIndex = filePath.lastIndexOf('.')
  const basePath = extIndex >= 0 ? filePath.slice(0, extIndex) : filePath
  return configService.relativeOutputPath(basePath)
}

export function registerVueTemplateToken(
  ctx: CompilerContext,
  filename: string,
  template: string | undefined,
) {
  if (!template) {
    return
  }

  const wxmlService = (ctx as Partial<CompilerContext>).wxmlService
  if (!wxmlService) {
    return
  }

  try {
    const token = wxmlService.analyze(template)
    wxmlService.tokenMap.set(filename, token)
    wxmlService.setWxmlComponentsMap(filename, token.components)
  }
  catch {
    // 忽略模板扫描异常，避免阻断 Vue 编译流程
  }
}
