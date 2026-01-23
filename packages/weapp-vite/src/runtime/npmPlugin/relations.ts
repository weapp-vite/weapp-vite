import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { toPosixPath } from '../../utils/path'
import { requireConfigService } from '../utils/requireConfigService'

export function getPackNpmRelationList(ctx: MutableCompilerContext) {
  const configService = requireConfigService(ctx, '解析 npm 关联列表前必须初始化 configService。')
  const multiPlatformConfig = configService.weappViteConfig?.multiPlatform
  const isMultiPlatformEnabled = Boolean(
    multiPlatformConfig
    && (typeof multiPlatformConfig !== 'object' || multiPlatformConfig.enabled !== false),
  )
  let packNpmRelationList: {
    packageJsonPath: string
    miniprogramNpmDistDir: string
  }[] = []
  if (configService.projectConfig.setting?.packNpmManually && Array.isArray(configService.projectConfig.setting.packNpmRelationList)) {
    packNpmRelationList = configService.projectConfig.setting.packNpmRelationList
  }
  else {
    packNpmRelationList = [
      {
        miniprogramNpmDistDir: '.',
        packageJsonPath: './package.json',
      },
    ]
  }
  if (!isMultiPlatformEnabled) {
    return packNpmRelationList
  }
  return packNpmRelationList.map((entry) => {
    const rawDir = entry.miniprogramNpmDistDir
    if (!rawDir || path.isAbsolute(rawDir)) {
      return entry
    }
    const normalized = toPosixPath(rawDir).replace(/\/+$/, '')
    const trimmed = normalized.startsWith('./') ? normalized.slice(2) : normalized
    if (trimmed !== 'dist') {
      return entry
    }
    return {
      ...entry,
      miniprogramNpmDistDir: path.join('dist', configService.platform, trimmed),
    }
  })
}
