import type { ProjectConfig, UpdateProjectConfigOptions } from './types'
import logger from '@weapp-core/logger'
import { defu, get, set } from '@weapp-core/shared'
import path from 'pathe'
import { ctx } from './state'
import { readJsonIfExists, writeJsonFile } from './utils/fs'
import { resolveOutputPath } from './utils/path'

function applyProjectConfigDefaults(projectConfig: ProjectConfig) {
  set(projectConfig, 'miniprogramRoot', 'dist/')
  set(projectConfig, 'srcMiniprogramRoot', 'dist/')
  set(projectConfig, 'setting.packNpmManually', true)

  const compileType = get(projectConfig, 'compileType')
  if (compileType === 'plugin') {
    set(projectConfig, 'pluginRoot', 'dist-plugin')
  }
}

function ensurePackNpmRelationList(projectConfig: ProjectConfig) {
  const relations = get(projectConfig, 'setting.packNpmRelationList')
  const defaultRelation = {
    packageJsonPath: './package.json',
    miniprogramNpmDistDir: './dist',
  }

  if (Array.isArray(relations)) {
    const exists = relations.some(
      relation => relation.packageJsonPath === defaultRelation.packageJsonPath && relation.miniprogramNpmDistDir === defaultRelation.miniprogramNpmDistDir,
    )
    if (!exists) {
      relations.push(defaultRelation)
    }
  }
  else {
    set(projectConfig, 'setting.packNpmRelationList', [defaultRelation])
  }
}

function createDefaultProjectConfig(): ProjectConfig {
  return {
    compileType: 'miniprogram',
    libVersion: 'trial',
    packOptions: {
      ignore: [],
      include: [],
    },
    setting: {
      coverView: true,
      es6: true,
      postcss: true,
      minified: true,
      enhance: true,
      showShadowRootInWxmlPanel: true,
      packNpmRelationList: [
        {
          packageJsonPath: './package.json',
          miniprogramNpmDistDir: './dist',
        },
      ],
      babelSetting: {
        ignore: [],
        disablePlugins: [],
        outputPath: '',
      },
      packNpmManually: true,
    },
    condition: {},
    editorSetting: {
      tabIndent: 'auto',
      tabSize: 2,
    },
    appid: '',
    miniprogramRoot: 'dist/',
    srcMiniprogramRoot: 'dist/',
  } as ProjectConfig
}

export async function createOrUpdateProjectConfig(options: UpdateProjectConfigOptions) {
  const { root, dest, cb, write, filename } = defu<
    Required<UpdateProjectConfigOptions>,
    Partial<UpdateProjectConfigOptions>[]
  >(
    options,
    {
      write: true,
      filename: 'project.config.json',
    },
  )

  const projectConfigFilename = ctx.projectConfig.name = filename
  const projectConfigPath = ctx.projectConfig.path = path.resolve(root, projectConfigFilename)
  const outputPath = resolveOutputPath(root, dest, projectConfigPath)

  try {
    let projectConfig = await readJsonIfExists<ProjectConfig>(projectConfigPath)

    if (projectConfig) {
      applyProjectConfigDefaults(projectConfig)
    }
    else {
      projectConfig = createDefaultProjectConfig()
      logger.info(`✨ 没有找到 ${projectConfigFilename} 文件，正在使用默认模板创建...`)
    }

    cb?.(
      (...args) => {
        set(projectConfig, ...args)
      },
    )

    ensurePackNpmRelationList(projectConfig)

    ctx.projectConfig.value = projectConfig

    if (write) {
      await writeJsonFile(outputPath, projectConfig)
      logger.log(`✨ 写入 ${path.relative(root, outputPath)} 成功!`)
    }

    return projectConfig
  }
  catch (error) {
    logger.error(`⚠️ 设置 ${projectConfigFilename} 配置文件失败`, error)
    throw error
  }
}
