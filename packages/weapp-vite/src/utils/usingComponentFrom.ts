import type { ConfigService } from '../runtime/config/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { toPosixPath } from './path'
import { isSkippableResolvedId, normalizeFsResolvedId } from './resolvedId'

export function usingComponentFromResolvedFile(
  resolvedFile: string | undefined,
  configService: Pick<ConfigService, 'relativeOutputPath'>,
) {
  if (!resolvedFile) {
    return undefined
  }

  const normalized = normalizeFsResolvedId(resolvedFile)
  if (!normalized || isSkippableResolvedId(normalized) || !path.isAbsolute(normalized)) {
    return undefined
  }

  const base = removeExtensionDeep(normalized)
  const relative = configService.relativeOutputPath(base)
  if (!relative || relative.startsWith('..')) {
    return undefined
  }

  return `/${toPosixPath(relative)}`
}
