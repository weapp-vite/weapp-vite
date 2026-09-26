import type { InlineConfig } from 'vite'
import type { ResolvedMultiPlatformConfig } from '../../../../multiPlatform'
import type { MpPlatform } from '../../../../types'
import type { LoadConfigResult } from '../../types'
import path from 'pathe'
import { resolveMultiPlatformConfig } from '../../../../multiPlatform'
import { createProjectConfigPlugin } from '../../../../plugins/projectConfig'
import {
  getProjectConfig,
  getProjectConfigFileName,
  getProjectConfigRootKeys,
  getProjectPrivateConfig,
  getProjectPrivateConfigFileName,
  resolveProjectConfigRoot,
} from '../../../../utils'
import { formatProjectConfigPath, normalizeRelativeDistRoot, resolveProjectConfigPaths } from './shared'

/** 在默认值合并前校验内联配置，避免无效的 null 字段被合并器忽略。 */
export function validateProjectConfigSources(...configs: Array<InlineConfig | undefined>) {
  for (const config of configs) {
    const multiPlatform = config?.weapp?.multiPlatform
    if (multiPlatform && typeof multiPlatform === 'object' && multiPlatform.projectConfigs !== undefined) {
      resolveMultiPlatformConfig(multiPlatform)
    }
  }
}

/** 分离内联项目配置与原生文件读取，统一管理项目路径和代码输出目录。 */
export async function loadProjectConfig(options: {
  config: InlineConfig
  cwd: string
  platform: MpPlatform
  multiPlatform: ResolvedMultiPlatformConfig
  projectConfigPath?: string
  outputRoot?: string
  pluginOnly: boolean
  isWebRuntime: boolean
  resolvedLibConfig: LoadConfigResult['weappLib']
}): Promise<Pick<LoadConfigResult, 'projectConfig' | 'projectPrivateConfig' | 'projectConfigPath' | 'projectPrivateConfigPath' | 'mpDistRoot'>> {
  const { config, cwd, platform, multiPlatform, projectConfigPath, outputRoot, pluginOnly, isWebRuntime, resolvedLibConfig } = options
  const buildConfig = config.build ?? (config.build = {})
  let projectConfig: Record<string, any> = {}
  let projectPrivateConfig: Record<string, any> = {}
  let projectConfigPathResolved: string | undefined
  let projectPrivateConfigPathResolved: string | undefined
  let mpDistRoot = ''
  const isLibMode = Boolean(resolvedLibConfig?.enabled)

  if (!isWebRuntime && !isLibMode) {
    if (multiPlatform.projectConfigs) {
      if (pluginOnly) {
        throw new Error('`weapp.multiPlatform.projectConfigs` 仅支持完整小程序，独立插件请使用原生 JSON 文件模式。')
      }
      const inlineProjectConfig = multiPlatform.projectConfigs[platform]
      if (!inlineProjectConfig) {
        throw new Error(`\`weapp.multiPlatform.projectConfigs\` 缺少当前平台 "${platform}" 的配置，不会回退到原生 JSON 文件。`)
      }
      projectConfig = {
        ...inlineProjectConfig,
        compileType: inlineProjectConfig.compileType ?? 'miniprogram',
        [platform === 'swan' ? 'smartProgramRoot' : 'miniprogramRoot']: '.',
      }
      mpDistRoot = outputRoot || (buildConfig.outDir ?? path.join('dist', platform, 'dist'))
      buildConfig.outDir = mpDistRoot
      config.plugins ??= []
      config.plugins.push(createProjectConfigPlugin(platform, projectConfig))
    }
    else {
      const { basePath, privatePath } = resolveProjectConfigPaths({
        platform,
        multiPlatform,
        projectConfigPath,
        isWebRuntime,
      })
      projectConfig = await getProjectConfig(cwd, { basePath, privatePath })
      projectPrivateConfig = await getProjectPrivateConfig(cwd, { privatePath })
      mpDistRoot = resolveProjectConfigRoot(projectConfig, platform) ?? ''
      if (!mpDistRoot) {
        const displayPath = formatProjectConfigPath(cwd, basePath ?? getProjectConfigFileName(platform))
        const hint = getProjectConfigRootKeys(platform).join(' 或 ')
        throw new Error(`请在 ${displayPath} 里设置 ${hint}, 比如可以设置为 dist/`)
      }
      if (multiPlatform.enabled && !path.isAbsolute(mpDistRoot)) {
        const normalizedDistRoot = normalizeRelativeDistRoot(mpDistRoot)
        if (normalizedDistRoot === 'dist') {
          mpDistRoot = path.join('dist', platform, normalizedDistRoot)
        }
      }
      if (outputRoot) {
        mpDistRoot = outputRoot
        buildConfig.outDir = outputRoot
      }
      else {
        buildConfig.outDir ??= mpDistRoot
      }
      projectConfigPathResolved = path.resolve(cwd, basePath ?? getProjectConfigFileName(platform))
      projectPrivateConfigPathResolved = path.resolve(cwd, privatePath ?? getProjectPrivateConfigFileName(platform))
    }
  }
  else if (isLibMode) {
    const libOutDir = buildConfig.outDir ?? resolvedLibConfig?.outDir ?? 'dist'
    buildConfig.outDir ??= libOutDir
    mpDistRoot = libOutDir
  }
  if (pluginOnly && buildConfig.outDir) {
    mpDistRoot = buildConfig.outDir
  }

  return {
    projectConfig,
    projectPrivateConfig,
    projectConfigPath: projectConfigPathResolved,
    projectPrivateConfigPath: projectPrivateConfigPathResolved,
    mpDistRoot,
  }
}
