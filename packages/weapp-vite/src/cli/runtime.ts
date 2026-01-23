import type { InlineConfig } from 'vite'
import type { MpPlatform } from '../types'
import logger from '../logger'
import { DEFAULT_MP_PLATFORM, normalizeMiniPlatform, resolveMiniPlatform } from '../platform'

export interface RuntimeTargets {
  runMini: boolean
  runWeb: boolean
  mpPlatform?: MpPlatform
  label: string
  rawPlatform?: string
}

export function logRuntimeTarget(targets: RuntimeTargets) {
  logger.info(`目标平台：${targets.label}`)
}

export function resolveRuntimeTargets(options: { platform?: string, p?: string }): RuntimeTargets {
  const rawPlatform = typeof options.platform === 'string'
    ? options.platform
    : typeof options.p === 'string'
      ? options.p
      : undefined
  if (!rawPlatform) {
    return {
      runMini: true,
      runWeb: false,
      mpPlatform: DEFAULT_MP_PLATFORM,
      label: DEFAULT_MP_PLATFORM,
      rawPlatform,
    }
  }
  const normalized = normalizeMiniPlatform(rawPlatform)
  if (!normalized) {
    return {
      runMini: true,
      runWeb: false,
      mpPlatform: DEFAULT_MP_PLATFORM,
      label: DEFAULT_MP_PLATFORM,
      rawPlatform,
    }
  }
  if (normalized === 'h5' || normalized === 'web') {
    return {
      runMini: false,
      runWeb: true,
      mpPlatform: undefined,
      label: normalized === 'h5' ? 'h5' : 'web',
      rawPlatform,
    }
  }
  const mpPlatform = resolveMiniPlatform(normalized)
  if (mpPlatform) {
    return {
      runMini: true,
      runWeb: false,
      mpPlatform,
      label: mpPlatform,
      rawPlatform,
    }
  }
  logger.warn(`未识别的平台 "${rawPlatform}"，已回退到 ${DEFAULT_MP_PLATFORM}`)
  return {
    runMini: true,
    runWeb: false,
    mpPlatform: DEFAULT_MP_PLATFORM,
    label: DEFAULT_MP_PLATFORM,
    rawPlatform,
  }
}

export function createInlineConfig(mpPlatform: MpPlatform | undefined): InlineConfig | undefined {
  if (!mpPlatform) {
    return undefined
  }
  return {
    weapp: {
      platform: mpPlatform,
    },
  }
}
