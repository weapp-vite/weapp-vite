import {
  createInjectRequestGlobalsCode,
  injectRequestGlobalsIntoSfc,
  resolveAutoRequestGlobalsTargets,
  resolveManualRequestGlobalsTargets,
} from '../../../../runtime/config/internal/injectRequestGlobals'

const NORMAL_SFC_SCRIPT_RE = /<script(?![^>]*setup)[^>]*>/u

export function resolvePassiveRequestGlobalsTargets(code: string, requestGlobalsTargets: string[]) {
  if (requestGlobalsTargets.length > 0) {
    return []
  }
  return resolveManualRequestGlobalsTargets(code)
}

export function resolveRequestGlobalsTargetsForCode(
  code: string,
  sourceId: string,
  options: {
    mode?: 'auto' | 'explicit'
    targets?: string[]
  } | null | undefined,
) {
  const requestGlobalsTargets = options?.targets ?? []
  if (requestGlobalsTargets.length === 0) {
    return []
  }
  if (options?.mode === 'auto') {
    if (
      sourceId.endsWith('.vue')
      && code.includes('<script setup')
      && !NORMAL_SFC_SCRIPT_RE.test(code)
    ) {
      return []
    }
    return resolveAutoRequestGlobalsTargets(code, requestGlobalsTargets as any)
  }
  return requestGlobalsTargets
}

export function injectRequestGlobalsIntoLoadResult(
  result: any,
  sourceId: string,
  targets: string[],
  options?: {
    localBindings?: boolean
    passiveLocalBindings?: boolean
  },
) {
  if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string' || targets.length === 0) {
    return result
  }

  if (sourceId.endsWith('.vue')) {
    return {
      ...result,
      code: injectRequestGlobalsIntoSfc(result.code, targets as any, options),
    }
  }

  return {
    ...result,
    code: `${createInjectRequestGlobalsCode(targets as any, options)}${result.code}`,
  }
}
