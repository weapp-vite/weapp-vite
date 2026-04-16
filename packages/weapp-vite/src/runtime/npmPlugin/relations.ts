import type { MutableCompilerContext } from '../../context'
import type { MpPlatform, ProjectConfig } from '../../types'
import path from 'pathe'
import { shouldUseProjectRootNpmDir } from '../../platform'
import { toPosixPath } from '../../utils/path'
import { resolveProjectConfigRoot } from '../../utils/projectConfig'
import { requireConfigService } from '../utils/requireConfigService'

const TRAILING_SLASHES_RE = /\/+$/
const EMPTY_VALUE_RE = /^$/

export function normalizeRelativeDir(value: string) {
  const normalized = toPosixPath(value).replace(TRAILING_SLASHES_RE, '')
  const trimmed = normalized.startsWith('./') ? normalized.slice(2) : normalized
  return trimmed.replace(EMPTY_VALUE_RE, '.')
}

export function resolvePlatformProjectRoot(configService: MutableCompilerContext['configService']) {
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
  const isMultiPlatformEnabled = configService.multiPlatform.enabled

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

  if (configService.pluginOnly) {
    const pluginOutputRoot = configService.absolutePluginOutputRoot ?? configService.outDir
    const [mainRelation] = packNpmRelationList
    if (!mainRelation) {
      return []
    }

    return [
      {
        ...mainRelation,
        miniprogramNpmDistDir: pluginOutputRoot,
      },
    ]
  }

  if (!isMultiPlatformEnabled) {
    if (!hasManualRelations && shouldUseProjectRootNpmDir(configService.platform)) {
      return [
        {
          ...packNpmRelationList[0],
          miniprogramNpmDistDir: resolvePlatformProjectRoot(configService),
        },
      ]
    }

    return packNpmRelationList
  }

  if (!hasManualRelations && shouldUseProjectRootNpmDir(configService.platform)) {
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
    const shouldRewriteRootDir = shouldUseProjectRootNpmDir(configService.platform)
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
