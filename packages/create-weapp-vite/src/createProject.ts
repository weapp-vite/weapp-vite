import type { PackageJson } from 'pkg-types'
import type { DependencyVersionStrategy } from './dependencyVersions'
import type { Toolchain } from './toolchain'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import logger from '@weapp-core/logger'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createAgentsGuidelines } from './agents'
import { copyTemplateDir, ensureDotGitignore, mergeGitignoreSource, shouldSkipTemplateFile } from './createProject/files'
import { resolveDependencyVersions, validateDependencyVersionStrategy } from './dependencyVersions'
import { TemplateName } from './enums'
import { installationCommand } from './installationCommand'
import { displayRegistry, registryEnvironment, resolveRegistryOptions } from './npm'
import { ensurePnpmBuildPolicy, findPnpmWorkspaceRoot } from './pnpmBuildPolicy'
import { installRecommendedSkills, RECOMMENDED_SKILLS_INSTALL_COMMAND } from './skills'
import { ensureManagedTypeScriptDevDependencies, normalizeTemplateDependencySpecs } from './templateDependencies'
import { getTemplateDefinition, TEMPLATE_DIR_MAP } from './templates'
import { assertPreparedTemplate } from './templates/prepared'
import { applyToolchain, validateToolchain, validateToolchainWorkspace } from './toolchain'
import { updateGitIgnore } from './updateGitignore'
import { writeJsonFile } from './utils/fs'
import { updatePreparedJson } from './utils/updateJson'

const TOURIST_APP_ID = 'touristappid'
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
function resolveWorkspaceTemplateDir(templateName: TemplateName) {
  const templateDirName = TEMPLATE_DIR_MAP[templateName]
  return templateDirName
    ? path.resolve(moduleDir, '../../../templates', templateDirName)
    : path.resolve(moduleDir, '../../../templates', templateName)
}

async function resolveTemplateDirs(templateName: TemplateName, toolchain: Toolchain = 'wv') {
  const packagedTemplateDir = path.resolve(moduleDir, '../templates', ...(toolchain === 'vite-plus' ? ['vite-plus'] : []), templateName)
  const workspaceTemplateDir = resolveWorkspaceTemplateDir(templateName)
  if (toolchain === 'vite-plus' && !await fs.pathExists(packagedTemplateDir)) {
    throw new Error('Vite Plus 模板尚未准备，请先运行 pnpm --filter create-weapp-vite templates:prepare；发布包须包含派生模板。')
  }
  if (toolchain === 'vite-plus') {
    await assertPreparedTemplate(packagedTemplateDir, templateName)
  }
  const preferredTemplateDir = await fs.pathExists(packagedTemplateDir)
    ? packagedTemplateDir
    : workspaceTemplateDir

  return {
    packagedTemplateDir,
    workspaceTemplateDir,
    preferredTemplateDir,
  }
}

async function rewriteProjectConfigAppId(targetDir: string) {
  const projectConfigPaths = [
    path.resolve(targetDir, 'project.config.json'),
    path.resolve(targetDir, 'config/weapp/project.config.json'),
  ]

  for (const projectConfigPath of projectConfigPaths) {
    if (!await fs.pathExists(projectConfigPath)) {
      continue
    }

    const projectConfig = await fs.readJSON(projectConfigPath) as Record<string, any>
    if (
      !projectConfig
      || typeof projectConfig !== 'object'
      || projectConfig.compileType === 'plugin'
      || projectConfig.appid === TOURIST_APP_ID
    ) {
      continue
    }

    projectConfig.appid = TOURIST_APP_ID
    await writeJsonFile(projectConfigPath, projectConfig)
  }
}

function createEmptyPackageJson(): PackageJson {
  return {
    name: 'weapp-vite-app',
    homepage: 'https://vite.weapp.dev/',
    type: 'module',
    scripts: {},
    devDependencies: {},
  }
}

export interface CreateProjectOptions {
  /** 选择构建宿主，业务模板与工具链独立。 */
  toolchain?: Toolchain
  installSkills?: boolean
  dependencyVersionStrategy?: DependencyVersionStrategy
  /** 本次依赖查询与建议安装命令使用的 registry，不写入用户配置。 */
  registry?: string
}

/**
 * @description 根据模板创建项目
 */
export async function createProject(
  targetDir: string = '',
  templateName: TemplateName = TemplateName.default,
  options: CreateProjectOptions = {},
) {
  const dependencyVersionStrategy = options.dependencyVersionStrategy ?? 'bundled'
  validateDependencyVersionStrategy(dependencyVersionStrategy)
  const toolchain = options.toolchain ?? 'wv'
  validateToolchain(toolchain)
  await validateToolchainWorkspace(targetDir || '.', toolchain)
  const network = await resolveRegistryOptions({ registry: options.registry, projectRoot: path.resolve(targetDir || '.') })

  const {
    preferredTemplateDir,
    workspaceTemplateDir,
  } = await resolveTemplateDirs(templateName, toolchain)
  const dotGitignorePath = path.resolve(targetDir, '.gitignore')
  const existingGitignore = await fs.pathExists(dotGitignorePath)
    ? await fs.readFile(dotGitignorePath, 'utf8')
    : null

  if (!await fs.pathExists(preferredTemplateDir) && !await fs.pathExists(workspaceTemplateDir)) {
    logger.warn(`没有找到 ${templateName} 模板!`)
    return
  }

  await copyTemplateDir(preferredTemplateDir, toolchain === 'vite-plus' ? preferredTemplateDir : workspaceTemplateDir, targetDir)
  await rewriteProjectConfigAppId(targetDir)

  const templatePackagePath = path.resolve(preferredTemplateDir, 'package.json')
  const packageJsonPath = path.resolve(targetDir, 'package.json')
  await ensureDotGitignore(targetDir)
  if (existingGitignore !== null && await fs.pathExists(dotGitignorePath)) {
    const currentGitignore = await fs.readFile(dotGitignorePath, 'utf8')
    await fs.writeFile(dotGitignorePath, mergeGitignoreSource(existingGitignore, currentGitignore))
  }
  const pkgJson = await fs.pathExists(templatePackagePath)
    ? await fs.readJSON(templatePackagePath) as PackageJson
    : createEmptyPackageJson()
  normalizeTemplateDependencySpecs(pkgJson)
  ensureManagedTypeScriptDevDependencies(pkgJson)

  const resolution = await resolveDependencyVersions(pkgJson, dependencyVersionStrategy, network)

  await ensurePnpmBuildPolicy(targetDir)
  await applyToolchain(targetDir, pkgJson, toolchain, { prepared: toolchain === 'vite-plus', framework: getTemplateDefinition(templateName)?.framework })
  if (toolchain === 'vite-plus') {
    await updatePreparedJson(packageJsonPath, pkgJson)
  }
  else {
    await writeJsonFile(packageJsonPath, pkgJson)
  }
  // eslint-disable-next-line ts/no-use-before-define
  await writeAgentsGuidelines(targetDir, templateName, toolchain, toolchain === 'vite-plus' ? await fs.readFile(path.join(preferredTemplateDir, 'AGENTS.md'), 'utf8') : undefined)
  await updateGitIgnore({ root: targetDir, write: true })

  if (options.installSkills) {
    logger.info(`🤖 即将安装 AI skills：${RECOMMENDED_SKILLS_INSTALL_COMMAND}`)
    logger.info('如果你更想手动执行，也可以在项目创建后自行运行上面的命令。')
    try {
      await installRecommendedSkills(targetDir, {
        env: registryEnvironment(network),
      })
      logger.log('✨ 已安装推荐的 AI skills!')
    }
    catch {
      logger.warn('安装 AI skills 未完成（网络错误、取消或超时），项目已保留。')
      logger.warn(`你可以稍后手动执行：${RECOMMENDED_SKILLS_INSTALL_COMMAND}`)
    }
  }

  if (toolchain === 'vite-plus') {
    const workspace = await findPnpmWorkspaceRoot(targetDir)
    if (workspace && path.resolve(workspace) !== path.resolve(targetDir)) {
      logger.info('Vite Plus 的 vp check 优先继承工作区根 lint/fmt 配置；成员预设不能覆盖根策略，请按 README 在根配置接入。')
    }
  }
  logger.log('✨ 创建模板成功!')
  logger.info(`依赖版本策略：${resolution.strategy}；registry：${displayRegistry(network.registry)}`)
  logger.info('进入项目目录后安装依赖：')
  // 临时环境配置不一定被 pnpm 的原生入口继承，安装提示显式保持同一个源。
  const temporaryRegistry = options.registry ?? process.env.CREATE_WEAPP_VITE_REGISTRY
    ?? process.env.npm_config_registry ?? process.env.NPM_CONFIG_REGISTRY
    ?? process.env.pnpm_config_registry ?? process.env.PNPM_CONFIG_REGISTRY
  logger.info(installationCommand(temporaryRegistry !== undefined ? network.registry : undefined))
}

async function writeAgentsGuidelines(targetDir: string, templateName: TemplateName, toolchain: Toolchain = 'wv', prepared?: string) {
  const agentsPath = path.resolve(targetDir, 'AGENTS.md')
  if (await fs.pathExists(agentsPath)) {
    const current = await fs.readFile(agentsPath, 'utf8')
    if (!current.includes('<!-- agents-generated: v1 -->')) {
      logger.warn('检测到已有非生成的 AGENTS.md，已保留原文件；请将自定义规则移到 AGENTS.local.md 后再运行生成。')
      return
    }
  }
  await fs.writeFile(agentsPath, prepared ?? createAgentsGuidelines(templateName, toolchain))
}

export const __internal = {
  createAgentsGuidelines,
  writeAgentsGuidelines,
  copyTemplateDir,
  ensureDotGitignore,
  rewriteProjectConfigAppId,
  resolveTemplateDirs,
  shouldSkipTemplateFile,
  installRecommendedSkills,
}
