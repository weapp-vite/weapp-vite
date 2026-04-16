import type { MpPlatform } from '../../types'
import { getMiniProgramDefaultBuildTarget } from '@weapp-core/shared'

const ECMASCRIPT_SHORTHAND_YEAR_MAP: Record<number, number> = {
  6: 2015,
  7: 2016,
  8: 2017,
  9: 2018,
  10: 2019,
  11: 2020,
  12: 2021,
  13: 2022,
  14: 2023,
  15: 2024,
}

const MIN_SUPPORTED_ECMA_YEAR = 2015
const NON_CONCRETE_BUILD_TARGETS = new Set(['esnext', 'latest', 'modules'])
const ECMASCRIPT_YEAR_TARGET_RE = /^es(\d{4})$/
const ECMASCRIPT_SHORTHAND_TARGET_RE = /^es(\d{1,2})$/

function unsupportedTargetMessage(target: string) {
  return `build.target "${target}" 低于 ES2015。Rolldown 仅支持 ES2015 及以上；\`weapp.es5\` / \`@swc/core\` 方案已废弃，请改为保持 \`build.target >= es2020\`，并在开发者工具中开启“将 JS 编译成 ES5”功能。`
}

export interface SanitizeTargetOptions {
  allowEs5: boolean
}

export interface SanitizedTargetResult {
  sanitized: string | string[] | false | undefined
  hasTarget: boolean
}

export function getDefaultBuildTarget(platform?: MpPlatform) {
  return getMiniProgramDefaultBuildTarget(platform)
}

export function isNonConcreteBuildTarget(target: string | string[] | false | undefined) {
  if (target === false || target === undefined) {
    return false
  }

  const values = Array.isArray(target) ? target : [target]
  return values.some((value) => {
    const normalized = String(value).toLowerCase()
    return NON_CONCRETE_BUILD_TARGETS.has(normalized)
  })
}

function sanitizeEcmaTarget(rawTarget: string, options: SanitizeTargetOptions) {
  const normalized = rawTarget.toLowerCase()
  if (normalized === 'esnext' || normalized === 'latest' || normalized === 'modules') {
    return rawTarget
  }

  if (normalized === 'es3' || normalized === 'es4' || normalized === 'es5') {
    if (options.allowEs5) {
      return 'es2015'
    }
    throw new Error(unsupportedTargetMessage(rawTarget))
  }

  const yearMatch = normalized.match(ECMASCRIPT_YEAR_TARGET_RE)
  if (yearMatch) {
    const year = Number(yearMatch[1])
    if (Number.isFinite(year) && year < MIN_SUPPORTED_ECMA_YEAR) {
      if (options.allowEs5) {
        return 'es2015'
      }
      throw new Error(unsupportedTargetMessage(rawTarget))
    }
    return `es${year}`
  }

  const shorthandMatch = normalized.match(ECMASCRIPT_SHORTHAND_TARGET_RE)
  if (shorthandMatch) {
    const edition = Number(shorthandMatch[1])
    if (Number.isNaN(edition)) {
      return rawTarget
    }
    if (edition <= 5) {
      if (options.allowEs5) {
        return 'es2015'
      }
      throw new Error(unsupportedTargetMessage(rawTarget))
    }
    const mappedYear = ECMASCRIPT_SHORTHAND_YEAR_MAP[edition]
    return mappedYear ? `es${mappedYear}` : rawTarget
  }

  return rawTarget
}

export function sanitizeBuildTarget(target: string | string[] | false | undefined, options: SanitizeTargetOptions): SanitizedTargetResult {
  if (target === undefined) {
    return {
      sanitized: undefined,
      hasTarget: false,
    }
  }

  if (target === false) {
    return {
      sanitized: false,
      hasTarget: true,
    }
  }

  const targetArray = Array.isArray(target) ? [...target] : [target]
  const sanitizedArray = targetArray.map(value => sanitizeEcmaTarget(String(value), options))

  return {
    sanitized: Array.isArray(target) ? sanitizedArray : sanitizedArray[0],
    hasTarget: true,
  }
}
