import {
  createInjectRequestGlobalsCode,
  injectRequestGlobalsIntoSfc,
  resolveManualRequestGlobalsTargets,
} from '../../../../runtime/config/internal/injectRequestGlobals'

export function resolvePassiveRequestGlobalsTargets(code: string, requestGlobalsTargets: string[]) {
  if (requestGlobalsTargets.length > 0) {
    return []
  }
  return resolveManualRequestGlobalsTargets(code)
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
