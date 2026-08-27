export interface WeapiMethodMappingRule {
  target: string
  mapArgs?: (args: unknown[]) => unknown[]
  mapResult?: (result: any, args?: unknown[]) => any
}

export type WeapiSupportLevel = 'native' | 'mapped' | 'fallback' | 'unsupported'

export interface ResolveMethodMappingOptions {
  allowFallback?: boolean
}

export interface WeapiResolvedMethodMapping {
  target: string
  source: 'explicit' | 'fallback' | 'identity'
  rule?: WeapiMethodMappingRule
}

export interface WeapiPlatformSupportMatrixItem {
  platform: string
  globalObject: string
  typeSource: string
  support: string
}

export interface WeapiMethodSupportMatrixItem {
  method: string
  description: string
  wxStrategy: string
  alipayStrategy: string
  douyinStrategy: string
  support: string
}

export interface WeapiMethodCompatibilityItem {
  method: string
  wxStrategy: string
  alipayTarget: string
  alipayStrategy: string
  alipaySupported: boolean
  alipaySupportLevel: WeapiSupportLevel
  alipaySemanticallyAligned: boolean
  douyinTarget: string
  douyinStrategy: string
  douyinSupported: boolean
  douyinSupportLevel: WeapiSupportLevel
  douyinSemanticallyAligned: boolean
  support: string
  semanticSupport: string
}

export interface WeapiApiCoveragePlatformItem {
  platform: string
  alias: string
  supportedApis: number
  semanticAlignedApis: number
  fallbackApis: number
  totalApis: number
  coverage: string
  semanticCoverage: string
}

export interface WeapiApiCoverageReport {
  totalApis: number
  fullyAlignedApis: number
  fullyAlignedCoverage: string
  fullySemanticallyAlignedApis: number
  fullySemanticallyAlignedCoverage: string
  platforms: readonly WeapiApiCoveragePlatformItem[]
}
