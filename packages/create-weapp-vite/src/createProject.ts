import type { PackageJson } from 'pkg-types'
import { fileURLToPath } from 'node:url'
import logger from '@weapp-core/logger'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { version as wevuVersion } from '../../../packages-runtime/wevu/package.json'
import { version } from '../../weapp-vite/package.json'
import { createAgentsGuidelines } from './agents'
import { TemplateName } from './enums'
import { TEMPLATE_CATALOG, TEMPLATE_NAMED_CATALOG } from './generated/catalog'
import { latestVersion } from './npm'
import { installRecommendedSkills, RECOMMENDED_SKILLS_INSTALL_COMMAND } from './skills'
import { updateGitIgnore } from './updateGitignore'
import { writeJsonFile } from './utils/fs'

const DIGIT_RE = /\d/
const CRLF_RE = /\r\n/g
const WINDOWS_VERBATIM_PATH_RE = /^\\\\\?\\/
const TOURIST_APP_ID = 'touristappid'
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR_MAP: Record<TemplateName, string> = {
  [TemplateName.default]: 'weapp-vite-template',
  [TemplateName.plugin]: 'weapp-vite-plugin-template',
  [TemplateName.lib]: 'weapp-vite-lib-template',
  [TemplateName.wevu]: 'weapp-vite-wevu-template',
  [TemplateName.wevuTdesign]: 'weapp-vite-wevu-tailwindcss-tdesign-template',
  [TemplateName.tailwindcss]: 'weapp-vite-tailwindcss-template',
  [TemplateName.tdesign]: 'weapp-vite-tailwindcss-tdesign-template',
  [TemplateName.vant]: 'weapp-vite-tailwindcss-vant-template',
}
const templateCatalogMap: Record<string, string> = { ...TEMPLATE_CATALOG }
const templateNamedCatalogMap: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(TEMPLATE_NAMED_CATALOG).map(([name, deps]) => [name, { ...deps }]),
)

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
    relativePath === 'node_modules'
    || relativePath.startsWith('node_modules/')
    || relativePath.includes('/node_modules/')
    || relativePath === '.weapp-vite'
    || relativePath.startsWith('.weapp-vite/')
    || relativePath.includes('/.weapp-vite/')
    || relativePath === 'vite.config.ts.timestamp'
    || relativePath.endsWith('/vite.config.ts.timestamp')
    || relativePath === 'dist'
    || relativePath.startsWith('dist/')
    || relativePath.includes('/dist/')
    || relativePath === 'CHANGELOG.md'
    || relativePath.endsWith('/CHANGELOG.md')
    || relativePath === '.turbo'
    || relativePath.startsWith('.turbo/')
    || relativePath.includes('/.turbo/')
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

  while (merged.length > 0 && merged.at(-1) === '') {
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
  const projectConfigPath = path.resolve(targetDir, 'project.config.json')
  if (!await fs.pathExists(projectConfigPath)) {
    return
  }

  const projectConfig = await fs.readJSON(projectConfigPath) as Record<string, any>
  if (!projectConfig || typeof projectConfig !== 'object' || projectConfig.appid === TOURIST_APP_ID) {
    return
  }

  projectConfig.appid = TOURIST_APP_ID
  await writeJsonFile(projectConfigPath, projectConfig)
}

function createEmptyPackageJson(): PackageJson {
  return {
    name: 'weapp-vite-app',
    homepage: 'https://vite.icebreaker.top/',
    type: 'module',
    scripts: {},
    devDependencies: {},
  }
}

async function upsertTailwindcssVersion(pkgJson: PackageJson) {
  if (!pkgJson.devDependencies) {
    return
  }

  const resolved = await latestVersion('weapp-tailwindcss')
  if (resolved) {
    pkgJson.devDependencies['weapp-tailwindcss'] = resolved
  }
  else if (!pkgJson.devDependencies['weapp-tailwindcss']) {
    pkgJson.devDependencies['weapp-tailwindcss'] = '^4.3.3'
  }
}

function upsertExistingDependencyVersion(pkgJson: PackageJson, packageName: string, resolvedVersion: string) {
  if (pkgJson.dependencies?.[packageName]) {
    pkgJson.dependencies[packageName] = resolvedVersion
  }
  if (pkgJson.devDependencies?.[packageName]) {
    pkgJson.devDependencies[packageName] = resolvedVersion
  }
  if (pkgJson.peerDependencies?.[packageName]) {
    pkgJson.peerDependencies[packageName] = resolvedVersion
  }
}

function toCaretVersion(version: string) {
  return version.startsWith('^') ? version : `^${version}`
}

function resolveCatalogSpec(packageName: string, spec: string): string {
  if (!spec.startsWith('catalog:')) {
    return spec
  }

  const catalogName = spec.slice('catalog:'.length)

  if (!catalogName) {
    return templateCatalogMap[packageName] ?? spec
  }

  const fromNamedCatalog = templateNamedCatalogMap[catalogName]?.[packageName]
  if (fromNamedCatalog) {
    if (fromNamedCatalog === 'latest') {
      return templateCatalogMap[packageName] ?? fromNamedCatalog
    }
    return fromNamedCatalog
  }

  return templateCatalogMap[packageName] ?? spec
}

function normalizeTemplateDependencySpecs(pkgJson: PackageJson) {
  const fields: Array<keyof PackageJson> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]

  for (const field of fields) {
    const deps = pkgJson[field] as Record<string, unknown> | undefined
    if (!deps) {
      continue
    }

    for (const [name, rawSpec] of Object.entries(deps)) {
      if (typeof rawSpec !== 'string' || !rawSpec) {
        continue
      }
      const spec = rawSpec
      if (spec.startsWith('catalog:')) {
        deps[name] = resolveCatalogSpec(name, spec)
      }
      else if (spec.startsWith('workspace:')) {
        const workspaceSpec = spec.slice('workspace:'.length)
        if (workspaceSpec && DIGIT_RE.test(workspaceSpec)) {
          deps[name] = workspaceSpec
          continue
        }
        const fromCatalog = templateCatalogMap[name]
        if (fromCatalog) {
          deps[name] = fromCatalog
        }
      }
    }
  }
}

function ensureManagedTypeScriptDevDependencies(pkgJson: PackageJson) {
  pkgJson.devDependencies ??= {}

  if (
    pkgJson.dependencies?.['@types/node']
    || pkgJson.devDependencies['@types/node']
    || pkgJson.peerDependencies?.['@types/node']
    || pkgJson.optionalDependencies?.['@types/node']
  ) {
    return
  }

  pkgJson.devDependencies['@types/node'] = templateCatalogMap['@types/node']
}

export interface CreateProjectOptions {
  installSkills?: boolean
}

/**
 * @description 根据模板创建项目
 */
export async function createProject(
  targetDir: string = '',
  templateName: TemplateName = TemplateName.default,
  options: CreateProjectOptions = {},
) {
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

  if (!pkgJson.devDependencies) {
    pkgJson.devDependencies = {}
  }

  upsertExistingDependencyVersion(pkgJson, 'weapp-vite', toCaretVersion(version))
  upsertExistingDependencyVersion(pkgJson, 'wevu', toCaretVersion(wevuVersion))
  await upsertTailwindcssVersion(pkgJson)

  await writeJsonFile(packageJsonPath, pkgJson)
  await fs.writeFile(path.resolve(targetDir, 'AGENTS.md'), createAgentsGuidelines(templateName))
  await updateGitIgnore({ root: targetDir, write: true })

  if (options.installSkills) {
    logger.info(`🤖 即将安装 AI skills：${RECOMMENDED_SKILLS_INSTALL_COMMAND}`)
    logger.info('如果你更想手动执行，也可以在项目创建后自行运行上面的命令。')
    try {
      await installRecommendedSkills(targetDir)
      logger.log('✨ 已安装推荐的 AI skills!')
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`安装 AI skills 失败：${message}`)
      logger.warn(`你可以稍后手动执行：${RECOMMENDED_SKILLS_INSTALL_COMMAND}`)
    }
  }

  logger.log('✨ 创建模板成功!')
}

export const __internal = {
  createAgentsGuidelines,
  copyTemplateDir,
  ensureDotGitignore,
  rewriteProjectConfigAppId,
  resolveTemplateDirs,
  shouldSkipTemplateFile,
  installRecommendedSkills,
  upsertTailwindcssVersion,
}
