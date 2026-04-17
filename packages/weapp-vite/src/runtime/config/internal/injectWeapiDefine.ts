import { createMiniProgramGlobalValueMap } from '../../../utils/miniProgramGlobals'
import { createWeapiAccessExpression } from '../../../utils/weapi'

export function isInjectWeapiReplaceEnabled(injectWeapi: unknown): boolean {
  const enabled = typeof injectWeapi === 'object'
    ? (injectWeapi as { enabled?: boolean }).enabled === true
    : injectWeapi === true

  if (!enabled || typeof injectWeapi !== 'object') {
    return false
  }

  return (injectWeapi as { replaceWx?: boolean }).replaceWx === true
}

export function resolveInjectWeapiGlobalName(injectWeapi: unknown): string {
  if (!injectWeapi || typeof injectWeapi !== 'object') {
    return 'wpi'
  }
  return (injectWeapi as { globalName?: string }).globalName?.trim() || 'wpi'
}

export function createInjectWeapiDefine(injectWeapi: unknown): Record<string, string> {
  if (!isInjectWeapiReplaceEnabled(injectWeapi)) {
    return {}
  }

  const globalName = resolveInjectWeapiGlobalName(injectWeapi)
  const expression = createWeapiAccessExpression(globalName)

  return createMiniProgramGlobalValueMap(expression)
}
