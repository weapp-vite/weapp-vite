import type { DocumentInput, LanguageOptions } from '@weapp-vite/language-service'
import type * as vscode from 'vscode'
import path from 'node:path'
import * as editor from 'vscode'
import { findNearestWeappViteProjectWorkspaceFolder } from '../project/workspace'
import { resolveTemplateLinkTarget } from '../template/templateProjectIndex'
import { clearCachedDocumentInputs, getCachedDocumentInput, setCachedDocumentInput } from './cache'
import { resolveProjectImport } from './moduleResolution'

export interface LanguageProjectConfiguration {
  root: string
  language: LanguageOptions
  fmt?: Record<string, unknown>
}

interface ProjectTools {
  loadProjectConfig: (cwd: string) => Promise<LanguageProjectConfiguration>
  resolveDocumentFormatOptions: (fileName: string, config: Record<string, unknown>) => { fileName: string, options: Record<string, unknown> }
  resolveProjectDocumentInput: (project: LanguageProjectConfiguration, fileName: string, source: string) => Promise<DocumentInput>
  resolveProjectReference?: (project: LanguageProjectConfiguration, fileName: string, source: string) => Promise<string | undefined>
}

interface FormatterTools {
  formatDocument: (source: string, fileName: string, options: Record<string, unknown> & LanguageOptions) => Promise<string>
}

interface LanguageDocumentState {
  configuration?: LanguageProjectConfiguration
  input: DocumentInput
}

const documentStates = new Map<string, { version: number, pending: Promise<LanguageDocumentState>, value?: LanguageDocumentState }>()
const configurations = new Map<string, Promise<LanguageProjectConfiguration>>()

export function invalidateLanguageProjectConfiguration() {
  documentStates.clear()
  configurations.clear()
  clearCachedDocumentInputs()
}

export function getCachedLanguageDocumentInput(document: vscode.TextDocument | string) {
  return getCachedDocumentInput(typeof document === 'string' ? document : document.uri.fsPath)
}

/** 仅在受信任工作区加载项目自己的工具，扩展不携带 native 格式化二进制。 */
async function importProjectTool<T>(document: vscode.TextDocument, specifier: string): Promise<{ tools: T, root: string } | undefined> {
  if (editor.workspace.isTrusted !== true) {
    return undefined
  }
  const folder = await findNearestWeappViteProjectWorkspaceFolder(document.uri.fsPath)
    ?? editor.workspace.getWorkspaceFolder(document.uri)
  if (!folder) {
    return undefined
  }
  const root = folder.uri.fsPath
  let resolved: string
  try {
    resolved = resolveProjectImport(specifier, root)
  }
  catch (error) {
    if (['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes((error as NodeJS.ErrnoException).code ?? '')) {
      return undefined
    }
    throw error
  }
  const tools = await import(resolved) as T
  return { tools, root }
}

export async function getLanguageDocumentState(document: vscode.TextDocument): Promise<LanguageDocumentState> {
  const key = document.uri.fsPath
  const previous = documentStates.get(key)
  if (previous && previous.version === document.version) {
    return previous.pending
  }
  const pending = (async (): Promise<LanguageDocumentState> => {
    const project = await importProjectTool<ProjectTools>(document, '@weapp-vite/oxfmt/project')
    if (!project) {
      return { input: { source: document.getText(), fileName: document.uri.fsPath } }
    }
    let configurationTask = configurations.get(project.root)
    if (!configurationTask) {
      configurationTask = project.tools.loadProjectConfig(project.root)
      configurations.set(project.root, configurationTask)
      if (configurations.size > 8) {
        configurations.delete(configurations.keys().next().value!)
      }
    }
    const configuration = await configurationTask
    const input = await project.tools.resolveProjectDocumentInput(configuration, document.uri.fsPath, document.getText())
    return { configuration, input }
  })()
  const state = { version: document.version, pending, value: undefined as LanguageDocumentState | undefined }
  documentStates.set(key, state)
  if (documentStates.size > 16) {
    documentStates.delete(documentStates.keys().next().value!)
  }
  try {
    const value = await pending
    state.value = value
    if (documentStates.get(key) === state) {
      setCachedDocumentInput(key, value.input)
    }
    return value
  }
  catch (error) {
    if (documentStates.get(key) === state) {
      documentStates.delete(key)
    }
    throw error
  }
}

/** 与 CLI 共用配置解析及 workspace 所有权；无工具的旧项目仍使用纯 TS 模板默认值。 */
export async function getLanguageProjectConfiguration(document: vscode.TextDocument) {
  return (await getLanguageDocumentState(document)).configuration
}

/** 与 CLI 复用项目边界和编译源替代解析；旧项目沿用既有模板路径解析。 */
export async function resolveLanguageProjectReference(document: vscode.TextDocument, source: string) {
  const project = await importProjectTool<ProjectTools>(document, '@weapp-vite/oxfmt/project')
  const { configuration } = await getLanguageDocumentState(document)
  return project?.tools.resolveProjectReference && configuration
    ? project.tools.resolveProjectReference(configuration, document.uri.fsPath, source)
    : (await resolveTemplateLinkTarget(document, 'src', source)) ?? undefined
}

/** 格式化原生样式和模块时使用当前项目版本，保持 CLI 与保存结果一致。 */
export async function formatProjectDocument(document: vscode.TextDocument, source: string, allowMissing = false) {
  const formatter = await importProjectTool<FormatterTools>(document, '@weapp-vite/oxfmt/languages')
  if (!formatter) {
    if (allowMissing) {
      return undefined
    }
    throw new Error(editor.workspace.isTrusted === true
      ? '此文件的格式化需要项目安装 @weapp-vite/oxfmt 和 Vite+。'
      : '请先信任工作区，再使用项目的小程序脚本及样式格式化器。')
  }
  const { configuration, input } = await getLanguageDocumentState(document)
  const fileName = configuration ? path.relative(configuration.root, document.uri.fsPath).replaceAll('\\', '/') : document.uri.fsPath
  const project = configuration && await importProjectTool<ProjectTools>(document, '@weapp-vite/oxfmt/project')
  const resolved = project ? project.tools.resolveDocumentFormatOptions(fileName, configuration?.fmt ?? {}) : { fileName, options: {} }
  return formatter.tools.formatDocument(source, resolved.fileName, {
    ...resolved.options,
    ...input.options,
    ...(input.platform ? { platform: input.platform } : {}),
    ...(input.sourceKind ? { sourceKind: input.sourceKind } : {}),
    ...(input.dialect ? { dialect: input.dialect } : {}),
    ...(input.language ? { language: input.language } : {}),
  })
}
