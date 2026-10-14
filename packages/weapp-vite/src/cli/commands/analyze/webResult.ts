import type { ConfigService } from '../../../runtime/config/types'

export interface WebAnalyzeResult {
  runtime: 'web'
  platform: 'web'
  mode: string
  generatedAt: string
  experimental: true
  configFile?: string
  web: {
    enabled: boolean
    root?: string
    srcDir?: string
    outDir?: string
    executionMode: 'compat' | 'safe' | 'strict'
  }
  supportedScopes: string[]
  unsupportedScopes: string[]
  limitations: string[]
}

interface CreateWebAnalyzeResultOptions {
  platform: 'web'
  now?: Date
}

function normalizeDisplayPath(value: string) {
  return value || '.'
}

function getDefaultWebAnalyzeScopes() {
  return {
    supported: [
      'weapp.web 配置解析（enable/root/srcDir/outDir）',
      'runtime.executionMode 静态解析（compat/safe/strict）',
      'JSON 报告输出（--json/--output）',
    ],
    unsupported: [
      '分包产物体积分析（仅小程序）',
      '源码模块包体映射（仅小程序）',
      '分析仪表盘（dashboard）',
    ],
  }
}

export function createWebAnalyzeResult(
  configService: ConfigService,
  options: CreateWebAnalyzeResultOptions,
): WebAnalyzeResult {
  const webConfig = configService.weappWebConfig
  const executionMode = webConfig?.pluginOptions.runtime?.executionMode ?? 'compat'
  const scope = getDefaultWebAnalyzeScopes()
  const limitations = [
    '当前仅提供静态配置分析，不执行 Web 产物扫描。',
  ]

  if (!webConfig?.enabled) {
    limitations.push('未检测到启用的 weapp.web 配置。')
  }

  return {
    runtime: 'web',
    platform: options.platform,
    mode: configService.mode,
    generatedAt: (options.now ?? new Date()).toISOString(),
    experimental: true,
    configFile: configService.configFilePath
      ? normalizeDisplayPath(configService.relativeCwd(configService.configFilePath))
      : undefined,
    web: {
      enabled: Boolean(webConfig?.enabled),
      root: webConfig?.root ? normalizeDisplayPath(configService.relativeCwd(webConfig.root)) : undefined,
      srcDir: webConfig?.srcDir,
      outDir: webConfig?.outDir ? normalizeDisplayPath(configService.relativeCwd(webConfig.outDir)) : undefined,
      executionMode,
    },
    supportedScopes: scope.supported,
    unsupportedScopes: scope.unsupported,
    limitations,
  }
}
