import { createWeapiAccessExpression } from '../../../utils/weapi'

export function createInjectWeapiDefine(injectWeapi: unknown): Record<string, string> {
  if (!injectWeapi) {
    return {}
  }

  const enabled = typeof injectWeapi === 'object'
    ? (injectWeapi as { enabled?: boolean }).enabled === true
    : injectWeapi === true

  if (!enabled || typeof injectWeapi !== 'object') {
    return {}
  }

  const options = injectWeapi as {
    replaceWx?: boolean
    globalName?: string
  }

  if (options.replaceWx !== true) {
    return {}
  }

  const globalName = options.globalName?.trim() || 'wpi'
  const expression = createWeapiAccessExpression(globalName)

  return {
    wx: expression,
    my: expression,
    tt: expression,
    swan: expression,
    jd: expression,
    xhs: expression,
  }
}
