import type { CompilerContext } from '../../../context'
import { getJsonPlatformOptions } from '../../../platform'

export interface VueTransformJsonPlatformOptions {
  platform: string
  normalizeUsingComponents: boolean
  dependencies?: Record<string, string>
  alipayNpmMode?: string
}

export function resolveVueTransformJsonPlatformOptions(
  configService?: Pick<CompilerContext['configService'], 'platform' | 'weappViteConfig' | 'packageJson'>,
) {
  const platform = configService?.platform ?? 'weapp'

  return {
    platform,
    normalizeUsingComponents: getJsonPlatformOptions(platform as any).normalizeUsingComponents,
    dependencies: configService?.packageJson?.dependencies,
    alipayNpmMode: configService?.weappViteConfig?.npm?.alipayNpmMode,
  } satisfies VueTransformJsonPlatformOptions
}
