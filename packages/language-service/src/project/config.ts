import type { OxfmtConfig } from 'vite-plus/fmt'
import type { OxlintConfig } from 'vite-plus/lint'
import type { LanguageOptions, LanguagePlatform } from '../types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { languageProfiles } from '../profiles'

export interface ProjectLanguageConfig {
  root: string
  fmt?: OxfmtConfig
  lint?: OxlintConfig
  language: LanguageOptions
}

interface ProjectConfigOptions {
  configFile?: string
  configKind?: 'fmt' | 'lint'
  workspaceFirst?: boolean
}

function platform(value: unknown): value is LanguagePlatform {
  return typeof value === 'string' && languageProfiles.some(profile => profile.platform === value)
}

function languageOptions(value: unknown, fallback: unknown): LanguageOptions {
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw new Error('weapp.language 必须为对象')
  }
  const options = (value ?? {}) as LanguageOptions
  if (options.platform !== undefined && !platform(options.platform)) {
    throw new Error(`无效的 weapp.language.platform：${String(options.platform)}`)
  }
  if (options.defaultPlatform !== undefined && !platform(options.defaultPlatform)) {
    throw new Error(`无效的 weapp.language.defaultPlatform：${String(options.defaultPlatform)}`)
  }
  if (options.overrides !== undefined && (!Array.isArray(options.overrides) || options.overrides.some(override => !override || !Array.isArray(override.files) || override.files.some(file => typeof file !== 'string') || !platform(override.platform)))) {
    throw new Error('weapp.language.overrides 需要 files glob 和已登记的平台')
  }
  return { ...(platform(fallback) ? { defaultPlatform: fallback } : {}), ...options }
}

/** 只在可信项目执行配置；工作区检查使用父配置，普通格式化使用最近配置。 */
export async function loadProjectConfig(cwd: string, options: ProjectConfigOptions = {}): Promise<ProjectLanguageConfig> {
  if (options.configFile?.endsWith('.json')) {
    const file = path.resolve(cwd, options.configFile)
    const value: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('格式配置必须为对象')
    }
    // eslint-disable-next-line ts/no-use-before-define -- JSON 入口与 Vite 搜索互相调用，函数声明均由模块初始化提升。
    const project = await loadViteProjectConfig(cwd, { workspaceFirst: options.workspaceFirst }, false)
    return { ...project, [options.configKind ?? 'fmt']: value }
  }
  // eslint-disable-next-line ts/no-use-before-define -- 保持 JSON 备用入口和 Vite 配置的单一搜索流程。
  return loadViteProjectConfig(cwd, options)
}

async function loadViteProjectConfig(cwd: string, options: ProjectConfigOptions, includeJson = true): Promise<ProjectLanguageConfig> {
  const vite = await import('vite-plus').catch((cause: unknown) => {
    throw new Error('读取项目语言配置需要项目安装 Vite+ >=1.2.0。', { cause })
  })
  const workspace = vite.searchForWorkspaceRoot(cwd)
  const directories: string[] = options.workspaceFirst ? [workspace] : []
  for (let current = cwd; !directories.includes(current); current = path.dirname(current)) {
    directories.push(current)
    if (current === workspace || current === path.dirname(current)) {
      break
    }
  }
  for (const directory of directories) {
    const loaded = await vite.loadConfigFromFile({ command: 'build', mode: 'production' }, options.configFile ? path.resolve(cwd, options.configFile) : undefined, directory, 'silent')
    if (loaded) {
      const config = loaded.config as typeof loaded.config & { weapp?: { language?: unknown, platform?: unknown } }
      if (config.fmt || config.lint || config.weapp) {
        return { root: path.dirname(loaded.path), fmt: config.fmt, lint: config.lint, language: languageOptions(config.weapp?.language, config.weapp?.platform) }
      }
    }
    if (options.configFile) {
      throw new Error(`${options.configFile} 没有导出项目检查配置`)
    }
    try {
      if (!includeJson) {
        continue
      }
      const json = await loadProjectConfig(directory, { configFile: '.oxfmtrc.json' })
      return json
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
  return { root: cwd, language: {} }
}
