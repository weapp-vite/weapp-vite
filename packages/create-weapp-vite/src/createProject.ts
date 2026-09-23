import type { PackageJson } from 'pkg-types'
import type { DependencyVersionStrategy } from './dependencyVersions'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import logger from '@weapp-core/logger'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { createAgentsGuidelines } from './agents'
import { resolveDependencyVersions, validateDependencyVersionStrategy } from './dependencyVersions'
import { TemplateName } from './enums'
import { installationCommand } from './installationCommand'
import { displayRegistry, registryEnvironment, resolveRegistryOptions } from './npm'
import { ensurePnpmBuildPolicy } from './pnpmBuildPolicy'
import { installRecommendedSkills, RECOMMENDED_SKILLS_INSTALL_COMMAND } from './skills'
import { ensureManagedTypeScriptDevDependencies, normalizeTemplateDependencySpecs } from './templateDependencies'
import { updateGitIgnore } from './updateGitignore'
import { writeJsonFile } from './utils/fs'

const CRLF_RE = /\r\n/g
const WINDOWS_VERBATIM_PATH_RE = /^\\\\\?\\/
const TOURIST_APP_ID = 'touristappid'
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR_MAP: Record<TemplateName, string> = {
  [TemplateName.default]: 'weapp-vite-template',
  [TemplateName.multiPlatform]: 'weapp-vite-multi-platform-template',
  [TemplateName.multiPlatformSfc]: 'weapp-vite-multi-platform-sfc-template',
  [TemplateName.plugin]: 'weapp-vite-plugin-template',
  [TemplateName.lib]: 'weapp-vite-lib-template',
  [TemplateName.wevu]: 'weapp-vite-wevu-template',
  [TemplateName.react]: 'weapp-vite-react-template',
  [TemplateName.wevuTdesign]: 'weapp-vite-wevu-tailwindcss-tdesign-template',
  [TemplateName.tailwindcss]: 'weapp-vite-tailwindcss-template',
  [TemplateName.tdesign]: 'weapp-vite-tailwindcss-tdesign-template',
  [TemplateName.vant]: 'weapp-vite-tailwindcss-vant-template',
}
function resolveWorkspaceTemplateDir(templateName: TemplateName) {
  const templateDirName = TEMPLATE_DIR_MAP[templateName]
  return templateDirName
    ? path.resolve(moduleDir, '../../../templates', templateDirName)
    : path.resolve(moduleDir, '../../../templates', templateName)
}

function normalizeTemplatePath(value: string) {
  return value.replace(WINDOWS_VERBATIM_PATH_RE, '').split('\\').join('/')
}

function normalizeTemplateRelativePath(relativePath: string) {
  if (!relativePath || relativePath === '.') {
    return ''
  }

  return normalizeTemplatePath(relativePath)
}

function isGeneratedOutputSegment(segment: string) {
  return segment === 'dist' || segment.startsWith('dist-')
}

function hasTemplatePathSegment(relativePath: string, predicate: (segment: string) => boolean) {
  return relativePath.split('/').some(predicate)
}

async function resolveTemplateDirs(templateName: TemplateName) {
  const packagedTemplateDir = path.resolve(moduleDir, '../templates', templateName)
  const workspaceTemplateDir = resolveWorkspaceTemplateDir(templateName)
  const preferredTemplateDir = await fs.pathExists(packagedTemplateDir)
    ? packagedTemplateDir
    : workspaceTemplateDir

  return {
    packagedTemplateDir,
    workspaceTemplateDir,
    preferredTemplateDir,
  }
}

function shouldSkipTemplateFile(filePath: string, templateRoot: string) {
  const relativePath = normalizeTemplateRelativePath(
    path.relative(normalizeTemplatePath(templateRoot), normalizeTemplatePath(filePath)),
  )

  if (!relativePath) {
    return false
  }

  return (
    hasTemplatePathSegment(relativePath, segment => segment === 'node_modules')
    || hasTemplatePathSegment(relativePath, segment => segment === '.weapp-vite')
    || hasTemplatePathSegment(relativePath, isGeneratedOutputSegment)
    || hasTemplatePathSegment(relativePath, segment => segment === '.turbo')
    || hasTemplatePathSegment(relativePath, segment => segment === '.npmrc')
    || relativePath === 'vite.config.ts.timestamp'
    || relativePath.endsWith('/vite.config.ts.timestamp')
    || relativePath === 'CHANGELOG.md'
    || relativePath.endsWith('/CHANGELOG.md')
    || relativePath === '.DS_Store'
    || relativePath.endsWith('/.DS_Store')
  )
}

function normalizeLines(value: string) {
  return value.replace(CRLF_RE, '\n').split('\n')
}

function mergeGitignoreSource(existing: string, template: string) {
  const merged = normalizeLines(existing)
  const seen = new Set(merged)

  for (const line of normalizeLines(template)) {
    if (seen.has(line)) {
      continue
    }
    merged.push(line)
    seen.add(line)
  }

  while (merged.length > 0 && merged[merged.length - 1] === '') {
    merged.pop()
  }

  return `${merged.join('\n')}\n`
}

async function copyTemplateDir(sourceDir: string, fallbackDir: string, targetDir: string) {
  const copyOptions = {
    filter(src: string) {
      return !shouldSkipTemplateFile(src, sourceDir)
    },
  }

  try {
    await fs.copy(sourceDir, targetDir, copyOptions)
  }
  catch (error) {
    const errorCode = (error as NodeJS.ErrnoException | undefined)?.code
    if (sourceDir === fallbackDir || errorCode !== 'ENOENT') {
      throw error
    }
    await fs.copy(fallbackDir, targetDir, copyOptions)
  }
}

async function ensureDotGitignore(root: string) {
  const gitignorePath = path.resolve(root, 'gitignore')
  const dotGitignorePath = path.resolve(root, '.gitignore')

  if (!await fs.pathExists(gitignorePath)) {
    return
  }

  if (await fs.pathExists(dotGitignorePath)) {
    await fs.remove(gitignorePath)
    return
  }

  await fs.move(gitignorePath, dotGitignorePath)
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
  const network = await resolveRegistryOptions({ registry: options.registry, projectRoot: path.resolve(targetDir || '.') })

  const {
    preferredTemplateDir,
    workspaceTemplateDir,
  } = await resolveTemplateDirs(templateName)
  const dotGitignorePath = path.resolve(targetDir, '.gitignore')
  const existingGitignore = await fs.pathExists(dotGitignorePath)
    ? await fs.readFile(dotGitignorePath, 'utf8')
    : null

  if (!await fs.pathExists(preferredTemplateDir) && !await fs.pathExists(workspaceTemplateDir)) {
    logger.warn(`没有找到 ${templateName} 模板!`)
    return
  }

  await copyTemplateDir(preferredTemplateDir, workspaceTemplateDir, targetDir)
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

  await writeJsonFile(packageJsonPath, pkgJson)
  await ensurePnpmBuildPolicy(targetDir)
  // eslint-disable-next-line ts/no-use-before-define
  await writeAgentsGuidelines(targetDir, templateName)
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

  logger.log('✨ 创建模板成功!')
  logger.info(`依赖版本策略：${resolution.strategy}；registry：${displayRegistry(network.registry)}`)
  logger.info('进入项目目录后安装依赖：')
  // 临时环境配置不一定被 pnpm 的原生入口继承，安装提示显式保持同一个源。
  const temporaryRegistry = options.registry ?? process.env.CREATE_WEAPP_VITE_REGISTRY
    ?? process.env.npm_config_registry ?? process.env.NPM_CONFIG_REGISTRY
    ?? process.env.pnpm_config_registry ?? process.env.PNPM_CONFIG_REGISTRY
  logger.info(installationCommand(temporaryRegistry !== undefined ? network.registry : undefined))
}

async function writeAgentsGuidelines(targetDir: string, templateName: TemplateName) {
  const agentsPath = path.resolve(targetDir, 'AGENTS.md')
  if (await fs.pathExists(agentsPath)) {
    const current = await fs.readFile(agentsPath, 'utf8')
    if (!current.includes('<!-- agents-generated: v1 -->')) {
      logger.warn('检测到已有非生成的 AGENTS.md，已保留原文件；请将自定义规则移到 AGENTS.local.md 后再运行生成。')
      return
    }
  }
  await fs.writeFile(agentsPath, createAgentsGuidelines(templateName))
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
