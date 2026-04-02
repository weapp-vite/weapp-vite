import type { WeapiResolvedMethodMapping, WeapiSupportLevel } from './types'

export function toSupportLevel(source: WeapiResolvedMethodMapping['source'], supported: boolean): WeapiSupportLevel {
  if (!supported) {
    return 'unsupported'
  }
  if (source === 'fallback') {
    return 'fallback'
  }
  if (source === 'explicit') {
    return 'mapped'
  }
  return 'native'
}

export function isSemanticSupportLevel(level: WeapiSupportLevel) {
  return level === 'native' || level === 'mapped'
}

export function resolveDefaultStrategy(
  platform: 'my' | 'tt',
  methodName: string,
  target: string,
  supported: boolean,
  source: WeapiResolvedMethodMapping['source'],
) {
  if (!supported) {
    return `未提供 ${platform}.${target}，调用时将返回 not supported`
  }
  if (source === 'fallback') {
    return `回退映射到 \`${platform}.${target}\`（通用兜底）`
  }
  if (target !== methodName) {
    return `映射到 \`${platform}.${target}\``
  }
  return `直连 \`${platform}.${methodName}\``
}

export function formatCoverageRate(supportedApis: number, totalApis: number) {
  if (totalApis <= 0) {
    return '100.00%'
  }
  return `${((supportedApis / totalApis) * 100).toFixed(2)}%`
}
