import type { MutableCompilerContext } from '../../context'
import type { MpPlatform, ProjectConfig } from '../../types'
import path from 'pathe'
import { toPosixPath } from '../../utils/path'
import { resolveProjectConfigRoot } from '../../utils/projectConfig'
import { requireConfigService } from '../utils/requireConfigService'

function normalizeRelativeDir(value: string) {
  const normalized = toPosixPath(value).replace(/\/+$/, '')
  const trimmed = normalized.startsWith('./') ? normalized.slice(2) : normalized
  return trimmed || '.'
}

function shouldUseProjectRootNpmStrategy(platform: string) {
  return platform === 'alipay'
}

function resolvePlatformProjectRoot(configService: MutableCompilerContext['configService']) {
  if (!configService) {
    return 'dist'
  }

  const projectRoot = resolveProjectConfigRoot(
    configService.projectConfig as ProjectConfig,
    configService.platform as MpPlatform,
  ) ?? 'dist'

  return normalizeRelativeDir(projectRoot)
}

export function getPackNpmRelationList(ctx: MutableCompilerContext) {
  const configService = requireConfigService(ctx, '解析 npm 关联列表前必须初始化 configService。')
  const multiPlatformConfig = configService.weappViteConfig?.multiPlatform
  const isMultiPlatformEnabled = Boolean(
    multiPlatformConfig
    && (typeof multiPlatformConfig !== 'object' || multiPlatformConfig.enabled !== false),
  )

  const hasManualRelations = Boolean(
    configService.projectConfig.setting?.packNpmManually
    && Array.isArray(configService.projectConfig.setting.packNpmRelationList),
  )

  const packNpmRelationList: {
    packageJsonPath: string
    miniprogramNpmDistDir: string
  }[] = hasManualRelations
    ? configService.projectConfig.setting!.packNpmRelationList
    : [
        {
          miniprogramNpmDistDir: '.',
          packageJsonPath: './package.json',
        },
      ]

  if (!isMultiPlatformEnabled) {
    if (!hasManualRelations && shouldUseProjectRootNpmStrategy(configService.platform)) {
      return [
        {
          ...packNpmRelationList[0],
          miniprogramNpmDistDir: resolvePlatformProjectRoot(configService),
        },
      ]
    }

    return packNpmRelationList
  }

  if (!hasManualRelations && shouldUseProjectRootNpmStrategy(configService.platform)) {
    return [
      {
        ...packNpmRelationList[0],
        miniprogramNpmDistDir: path.join('dist', configService.platform, resolvePlatformProjectRoot(configService)),
      },
    ]
  }

  return packNpmRelationList.map((entry) => {
    const rawDir = entry.miniprogramNpmDistDir
    if (!rawDir || path.isAbsolute(rawDir)) {
      return entry
    }

    const trimmed = normalizeRelativeDir(rawDir)
    const shouldRewriteRootDir = shouldUseProjectRootNpmStrategy(configService.platform)
    const shouldRewrite = trimmed === 'dist' || (shouldRewriteRootDir && trimmed === '.')
    if (!shouldRewrite) {
      return entry
    }

    return {
      ...entry,
      miniprogramNpmDistDir: path.join('dist', configService.platform, trimmed),
    }
  })
}
