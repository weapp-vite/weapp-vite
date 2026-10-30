import type { DocumentAnalysis } from '../index'
import type { Diagnostic, DocumentInput, LanguageOptions, LanguagePlatform } from '../types'
import type { ProjectLanguageConfig } from './config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { analyzeDocument } from '../index'
import { resolveLanguageProfile, TEMPLATE_EXTENSIONS } from '../profiles'
import { LanguageError } from '../types'
import { collectProjectFiles, isNativeDocument } from './files'
import { collectModuleOwners, moduleInput, resolveProjectModule } from './ownership'

export interface ProjectDocument {
  file: string
  fileName: string
  source: string
  platform?: LanguagePlatform
  input: DocumentInput
  analysis: DocumentAnalysis
}

/** 从模板引用传播模块所属平台，不根据共享的 SJS 后缀猜测宿主。 */
export async function analyzeProject(root: string, inputs: string[] = ['.'], options: LanguageOptions = {}, ignores: string[] = [], sourceOverrides: ReadonlyMap<string, string> = new Map()): Promise<ProjectDocument[]> {
  root = path.resolve(root)
  const available = new Set(await collectProjectFiles(root, ['.'], ignores))
  const selected = new Set(await collectProjectFiles(root, inputs, ignores))
  for (const file of sourceOverrides.keys()) {
    const relative = path.relative(root, file)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error('编辑文档必须位于所属项目内')
    }
    available.add(file)
    selected.add(file)
  }
  const documents = new Map<string, ProjectDocument>()
  async function load(file: string, context: Partial<DocumentInput> = {}) {
    const existing = documents.get(file)
    if (existing) {
      if (!Object.keys(context).length) {
        return existing
      }
      const input = { ...existing.input, ...context }
      const analysis = analyzeDocument(input)
      return { ...existing, input, analysis, platform: analysis.platform }
    }
    const source = sourceOverrides.get(file) ?? await readFile(file, 'utf8')
    const fileName = path.relative(root, file).split(path.sep).join('/')
    const input = { source, fileName, options, ...context }
    const analysis = analyzeDocument(input)
    const document = { file, fileName, source, input, platform: analysis.platform, analysis }
    documents.set(file, document)
    return document
  }
  for (const file of available) {
    if (isNativeDocument(file)) {
      await load(file)
    }
  }
  const owners = await collectModuleOwners(root, available, documents, load, options)
  for (const document of documents.values()) {
    if (TEMPLATE_EXTENSIONS.some(extension => document.fileName.toLowerCase().endsWith(extension))) {
      continue
    }
    const inherited = owners.get(document.file)
    const explicit = resolveLanguageProfile(document.fileName, { ...options, defaultPlatform: undefined })
    const platforms = new Set(inherited?.map(owner => owner.platform))
    const contexts = new Set(inherited?.map(owner => JSON.stringify(moduleInput(document.fileName, owner))))
    if (inherited?.length) {
      const owner = inherited[0]!
      document.input = { ...document.input, ...moduleInput(document.fileName, owner), platform: explicit?.platform ?? (platforms.size === 1 ? owner.platform : undefined) }
      document.analysis = analyzeDocument(document.input)
      document.platform = document.analysis.platform
    }
    if ((!explicit && platforms.size > 1) || contexts.size > 1) {
      const diagnostic: Diagnostic = { code: 'language/ambiguous-platform', severity: 'error', start: 0, end: 0, message: `模块存在冲突的引用归属（${[...platforms].join('、')}），请统一源文件方言或用 weapp.language.overrides 明确平台。` }
      document.analysis = { ...document.analysis, valid: false, diagnostics: [...document.analysis.diagnostics, diagnostic] }
    }
    const diagnostics = document.analysis.diagnostics.map(diagnostic => diagnostic.code === 'script/platform-required' ? { ...diagnostic, severity: 'error' as const } : diagnostic)
    document.analysis = { ...document.analysis, valid: diagnostics.every(diagnostic => diagnostic.severity !== 'error'), diagnostics }
  }
  return [...documents.values()].filter(document => selected.has(document.file)).sort((left, right) => left.fileName.localeCompare(right.fileName))
}

/** 编辑器传入未保存源码，沿用与 CLI 相同的项目引用归属和配置。 */
export async function resolveProjectDocumentInput(project: ProjectLanguageConfig, fileName: string, source: string): Promise<DocumentInput> {
  const file = path.resolve(project.root, fileName)
  const documents = await analyzeProject(project.root, [path.relative(project.root, file).split(path.sep).join('/')], project.language, [], new Map([[file, source]]))
  const document = documents.find(candidate => candidate.file === file)
  const platformErrors = document?.analysis.diagnostics.filter(diagnostic => diagnostic.code === 'language/ambiguous-platform' || diagnostic.code === 'script/platform-required') ?? []
  if (platformErrors.length) {
    throw new LanguageError(fileName, platformErrors)
  }
  return document?.input ?? { source, fileName: path.relative(project.root, file).split(path.sep).join('/'), options: project.language }
}

/** 编辑器和项目图共用静态路径解析，包含项目根路径及编译源替代。 */
export async function resolveProjectReference(project: ProjectLanguageConfig, fileName: string, source: string): Promise<string | undefined> {
  const files = new Set(await collectProjectFiles(project.root))
  return resolveProjectModule(project.root, path.resolve(project.root, fileName), source, files)
}

/** 诊断位置以 UTF-16 计算，输出使用稳定的相对路径与一基行列。 */
export function printDiagnostic(fileName: string, source: string, diagnostic: Diagnostic): string {
  const prefix = source.slice(0, diagnostic.start)
  const line = prefix.split('\n').length
  const column = prefix.length - prefix.lastIndexOf('\n')
  return `${fileName.replaceAll('\\', '/')}:${line}:${column} ${diagnostic.severity} ${diagnostic.code} ${diagnostic.message}`
}
