import type { CorePluginState } from '../../helpers'
import { isCSSRequest } from '../../../../utils'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { parseRequest } from '../../../utils/parse'

export function resolveInjectWeapiOptions(configService: CorePluginState['ctx']['configService']) {
  const injectWeapi = configService.weappViteConfig?.injectWeapi
  if (!injectWeapi) {
    return null
  }

  const enabled = typeof injectWeapi === 'object'
    ? injectWeapi.enabled === true
    : injectWeapi === true

  if (!enabled || typeof injectWeapi !== 'object' || injectWeapi.replaceWx !== true) {
    return null
  }

  return {
    globalName: injectWeapi.globalName?.trim() || 'wpi',
  }
}

export function shouldTransformId(
  id: string,
  options: {
    absoluteSrcRoot: string
    isEntry?: (sourceId: string) => boolean
  },
) {
  if (isCSSRequest(id)) {
    return false
  }

  const parsed = parseRequest(id)
  if (parsed.query.type === 'style') {
    return false
  }

  const sourceId = normalizeFsResolvedId(id)
  if (!sourceId) {
    return false
  }
  if (sourceId === options.absoluteSrcRoot) {
    return true
  }
  if (sourceId.startsWith(`${options.absoluteSrcRoot}/`)) {
    return true
  }
  return options.isEntry?.(sourceId) === true
}
