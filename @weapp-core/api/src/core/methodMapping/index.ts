import type {
  ResolveMethodMappingOptions,
  WeapiApiCoveragePlatformItem,
  WeapiApiCoverageReport,
  WeapiMethodCompatibilityItem,
  WeapiMethodMappingRule,
  WeapiMethodSupportMatrixItem,
  WeapiResolvedMethodMapping,
} from './types'
import {
  WEAPI_ALIPAY_METHODS,
  WEAPI_DOUYIN_METHODS,
  WEAPI_MINIPROGRAM_METHODS,
} from '../apiCatalog'
import {
  formatCoverageRate,
  isSemanticSupportLevel,
  resolveDefaultStrategy,
  toSupportLevel,
} from './compatibilityUtils'
import { METHOD_MAPPINGS, normalizePlatformName } from './rules'
import { WEAPI_METHOD_SUPPORT_MATRIX, WEAPI_PLATFORM_SUPPORT_MATRIX } from './supportMatrix'

export type {
  ResolveMethodMappingOptions,
  WeapiApiCoveragePlatformItem,
  WeapiApiCoverageReport,
  WeapiMethodCompatibilityItem,
  WeapiMethodMappingRule,
  WeapiMethodSupportMatrixItem,
  WeapiPlatformSupportMatrixItem,
  WeapiResolvedMethodMapping,
} from './types'

export {
  WEAPI_METHOD_SUPPORT_MATRIX,
  WEAPI_PLATFORM_SUPPORT_MATRIX,
}

const WEAPI_MINIPROGRAM_METHOD_SET = new Set<string>(WEAPI_MINIPROGRAM_METHODS)
const WEAPI_ALIPAY_METHOD_SET = new Set<string>(WEAPI_ALIPAY_METHODS)
const WEAPI_DOUYIN_METHOD_SET = new Set<string>(WEAPI_DOUYIN_METHODS)

const PLATFORM_METHOD_SET: Readonly<Record<'my' | 'tt', Set<string>>> = {
  my: WEAPI_ALIPAY_METHOD_SET,
  tt: WEAPI_DOUYIN_METHOD_SET,
}

function createFallbackMappingRule(platform: 'my' | 'tt', methodName: string): WeapiMethodMappingRule | undefined {
  void platform
  void methodName
  return undefined
}

function resolveMappingRule(
  platform: 'my' | 'tt',
  methodName: string,
  options: ResolveMethodMappingOptions = {},
): WeapiResolvedMethodMapping {
  const methodSet = PLATFORM_METHOD_SET[platform]
  const explicitRule = METHOD_MAPPINGS[platform]?.[methodName]
  if (explicitRule) {
    return {
      target: explicitRule.target,
      source: 'explicit',
      rule: explicitRule,
    }
  }
  if (methodSet.has(methodName)) {
    return {
      target: methodName,
      source: 'identity',
    }
  }
  if (options.allowFallback === false) {
    return {
      target: methodName,
      source: 'identity',
    }
  }
  const fallbackRule = createFallbackMappingRule(platform, methodName)
  if (fallbackRule) {
    return {
      target: fallbackRule.target,
      source: 'fallback',
      rule: fallbackRule,
    }
  }
  return {
    target: methodName,
    source: 'identity',
  }
}

function resolvePlatformCompatibility(platform: 'my' | 'tt', methodName: string) {
  const resolution = resolveMappingRule(platform, methodName)
  const target = resolution.target
  const supported = PLATFORM_METHOD_SET[platform].has(target)
  const supportLevel = toSupportLevel(resolution.source, supported)
  return {
    resolution,
    target,
    supported,
    supportLevel,
    semanticallyAligned: isSemanticSupportLevel(supportLevel),
  }
}

/**
 * @description 生成 API 支持覆盖率报告
 */
export function generateApiSupportCoverageReport(): WeapiApiCoverageReport {
  const methodNames = WEAPI_MINIPROGRAM_METHODS as readonly string[]
  const totalApis = methodNames.length
  let alipaySupportedApis = 0
  let douyinSupportedApis = 0
  let alipaySemanticAlignedApis = 0
  let douyinSemanticAlignedApis = 0
  let alipayFallbackApis = 0
  let douyinFallbackApis = 0
  let fullyAlignedApis = 0
  let fullySemanticallyAlignedApis = 0

  for (const methodName of methodNames) {
    const alipay = resolvePlatformCompatibility('my', methodName)
    const douyin = resolvePlatformCompatibility('tt', methodName)
    if (alipay.supported) {
      alipaySupportedApis += 1
    }
    if (douyin.supported) {
      douyinSupportedApis += 1
    }
    if (alipay.semanticallyAligned) {
      alipaySemanticAlignedApis += 1
    }
    if (douyin.semanticallyAligned) {
      douyinSemanticAlignedApis += 1
    }
    if (alipay.supportLevel === 'fallback') {
      alipayFallbackApis += 1
    }
    if (douyin.supportLevel === 'fallback') {
      douyinFallbackApis += 1
    }
    if (alipay.supported && douyin.supported) {
      fullyAlignedApis += 1
    }
    if (alipay.semanticallyAligned && douyin.semanticallyAligned) {
      fullySemanticallyAlignedApis += 1
    }
  }

  const wxSupportedApis = totalApis
  const wxSemanticAlignedApis = totalApis

  const platforms: readonly WeapiApiCoveragePlatformItem[] = [
    {
      platform: '微信小程序',
      alias: 'wx',
      supportedApis: wxSupportedApis,
      semanticAlignedApis: wxSemanticAlignedApis,
      fallbackApis: 0,
      totalApis,
      coverage: formatCoverageRate(wxSupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(wxSemanticAlignedApis, totalApis),
    },
    {
      platform: '支付宝小程序',
      alias: 'my',
      supportedApis: alipaySupportedApis,
      semanticAlignedApis: alipaySemanticAlignedApis,
      fallbackApis: alipayFallbackApis,
      totalApis,
      coverage: formatCoverageRate(alipaySupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(alipaySemanticAlignedApis, totalApis),
    },
    {
      platform: '抖音小程序',
      alias: 'tt',
      supportedApis: douyinSupportedApis,
      semanticAlignedApis: douyinSemanticAlignedApis,
      fallbackApis: douyinFallbackApis,
      totalApis,
      coverage: formatCoverageRate(douyinSupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(douyinSemanticAlignedApis, totalApis),
    },
  ]

  return {
    totalApis,
    fullyAlignedApis,
    fullyAlignedCoverage: formatCoverageRate(fullyAlignedApis, totalApis),
    fullySemanticallyAlignedApis,
    fullySemanticallyAlignedCoverage: formatCoverageRate(fullySemanticallyAlignedApis, totalApis),
    platforms,
  }
}

/**
 * @description 生成微信命名下的全量跨平台兼容矩阵
 */
export function generateMethodCompatibilityMatrix(): readonly WeapiMethodCompatibilityItem[] {
  const detailByMethod = new Map<string, WeapiMethodSupportMatrixItem>(
    WEAPI_METHOD_SUPPORT_MATRIX.map(item => [item.method, item]),
  )

  return (WEAPI_MINIPROGRAM_METHODS as readonly string[]).map((methodName) => {
    const alipay = resolvePlatformCompatibility('my', methodName)
    const douyin = resolvePlatformCompatibility('tt', methodName)
    const detail = detailByMethod.get(methodName)
    return {
      method: methodName,
      wxStrategy: detail?.wxStrategy ?? `直连 \`wx.${methodName}\``,
      alipayTarget: alipay.target,
      alipayStrategy: detail?.alipayStrategy ?? resolveDefaultStrategy('my', methodName, alipay.target, alipay.supported, alipay.resolution.source),
      alipaySupported: alipay.supported,
      alipaySupportLevel: alipay.supportLevel,
      alipaySemanticallyAligned: alipay.semanticallyAligned,
      douyinTarget: douyin.target,
      douyinStrategy: detail?.douyinStrategy ?? resolveDefaultStrategy('tt', methodName, douyin.target, douyin.supported, douyin.resolution.source),
      douyinSupported: douyin.supported,
      douyinSupportLevel: douyin.supportLevel,
      douyinSemanticallyAligned: douyin.semanticallyAligned,
      support: alipay.supported && douyin.supported ? '✅' : '⚠️',
      semanticSupport: alipay.semanticallyAligned && douyin.semanticallyAligned ? '✅' : '⚠️',
    }
  })
}

export function validateSupportMatrixConsistency() {
  const mappedMethods = new Set(Object.keys(METHOD_MAPPINGS.my ?? {}))
  const douyinMappedMethods = new Set(Object.keys(METHOD_MAPPINGS.tt ?? {}))
  const documentedMethods = new Set(WEAPI_METHOD_SUPPORT_MATRIX.map(item => item.method))
  const missingDocs = [...mappedMethods].filter(method => !documentedMethods.has(method))
  const missingMappings = [...documentedMethods].filter(method => !mappedMethods.has(method))
  const missingDouyinMappings = [...mappedMethods].filter(method => !douyinMappedMethods.has(method))
  const extraDouyinMappings = [...douyinMappedMethods].filter(method => !mappedMethods.has(method))
  const missingCatalogMethods = [...documentedMethods].filter(method =>
    !WEAPI_MINIPROGRAM_METHOD_SET.has(method)
    && !WEAPI_ALIPAY_METHOD_SET.has(method)
    && !WEAPI_DOUYIN_METHOD_SET.has(method),
  )
  return {
    missingDocs,
    missingMappings,
    missingDouyinMappings,
    extraDouyinMappings,
    missingCatalogMethods,
  }
}

/**
 * @description 解析平台 API 映射规则
 */
export function resolveMethodMapping(platform: string | undefined, methodName: string) {
  const normalizedPlatform = normalizePlatformName(platform)
  if (!normalizedPlatform) {
    return undefined
  }
  if (normalizedPlatform !== 'my' && normalizedPlatform !== 'tt') {
    return undefined
  }
  return resolveMappingRule(normalizedPlatform, methodName).rule
}

/**
 * @description 解析平台 API 映射规则及映射来源
 */
export function resolveMethodMappingWithMeta(
  platform: string | undefined,
  methodName: string,
  options: ResolveMethodMappingOptions = {},
) {
  const normalizedPlatform = normalizePlatformName(platform)
  if (!normalizedPlatform) {
    return undefined
  }
  if (normalizedPlatform !== 'my' && normalizedPlatform !== 'tt') {
    return undefined
  }
  return resolveMappingRule(normalizedPlatform, methodName, options)
}
