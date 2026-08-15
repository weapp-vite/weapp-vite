import type { MiniProgramNetworkDefaults } from '@wevu/web-apis'
import {
  createInjectRequestGlobalsCode,
  resolveAutoRequestGlobalsTargets,
  resolveManualRequestGlobalsTargets,
  resolveRequestGlobalsSfcInjection,
} from '../../../../runtime/config/internal/injectRequestGlobals'
import { editCodeTransformResult } from '../../../../utils/codeTransform'

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
    networkDefaults?: MiniProgramNetworkDefaults
    passiveLocalBindings?: boolean
    sourceMap?: boolean
  },
) {
  if (!result || typeof result !== 'object' || !('code' in result) || typeof result.code !== 'string' || targets.length === 0) {
    return result
  }

  if (sourceId.endsWith('.vue')) {
    const injection = resolveRequestGlobalsSfcInjection(result.code, targets as any, options)
    if (!injection) {
      return result
    }
    return editCodeTransformResult(
      result,
      sourceId,
      magicString => magicString.appendLeft(injection.index, injection.code),
      { sourceMap: options?.sourceMap },
    )
  }

  const injection = createInjectRequestGlobalsCode(targets as any, options)
  return editCodeTransformResult(
    result,
    sourceId,
    magicString => magicString.prepend(injection),
    { sourceMap: options?.sourceMap },
  )
}
