import type { DocumentInput, ScriptAnalysis, ScriptExportScope, ScriptExternalUse, ScriptSymbol } from '@weapp-vite/language-service'
import { analyzeScript, FILTER_EXTENSIONS, SCRIPT_EXTENSIONS, TEMPLATE_EXTENSIONS } from '@weapp-vite/language-service'
import * as vscode from 'vscode'
import { getLanguageDocumentInput } from '../documents'
import { getTemplateModules } from '../modules/model'
import { resolveLanguageProjectReference } from '../project'
import { resolveImportedScriptSymbol } from './exports'

export interface ScriptModel {
  document: vscode.TextDocument
  analysis: ScriptAnalysis
  offset: number
  input: DocumentInput
}

export interface ScriptTarget {
  model: ScriptModel
  symbol?: ScriptSymbol
  name: string
  scope: ScriptExportScope
}

export { externalUseAt } from './selection'

export async function getScriptModel(document: vscode.TextDocument, input?: DocumentInput): Promise<ScriptModel> {
  const resolved = input ?? await getLanguageDocumentInput(document)
  return { document, analysis: analyzeScript(resolved), offset: 0, input: resolved }
}

/** 模块路径使用项目适配层解析，包含类型源码替代和项目根边界。 */
export async function resolveExternalScriptTarget(model: ScriptModel, use: Pick<ScriptExternalUse, 'source' | 'imported' | 'targetScope' | 'targetPath'>): Promise<ScriptTarget | undefined> {
  const target = await resolveLanguageProjectReference(model.document, use.source)
  if (!target) {
    return undefined
  }
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target))
    const dependency = await getScriptModel(document)
    const symbol = resolveImportedScriptSymbol(dependency, use)
    return symbol || use.imported === '*' ? { model: dependency, symbol, name: symbol?.name ?? use.imported, scope: symbol?.exportScope ?? use.targetScope } : undefined
  }
  catch {
    return undefined
  }
}

/** 仅扫描原生模块和模板入口，再沿已确认的依赖遍历，不把普通 AppService 全部重新分析。 */
export async function projectScriptModels(origin: ScriptModel) {
  const result = new Map<string, ScriptModel>()
  const pending: ScriptModel[] = []
  const add = (model: ScriptModel) => {
    const key = `${model.document.uri.fsPath}:${model.offset}`
    if (!result.has(key)) {
      result.set(key, model)
      pending.push(model)
    }
  }
  add(origin)
  const folder = vscode.workspace.getWorkspaceFolder(origin.document.uri)
  const documents = new Map<string, vscode.TextDocument>()
  if (folder) {
    const extensions = ['.vue', ...TEMPLATE_EXTENSIONS, ...SCRIPT_EXTENSIONS.flatMap(extension => [extension, `${extension}.ts`, `${extension}.js`]), ...FILTER_EXTENSIONS].map(extension => extension.slice(1)).join(',')
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, `**/*.{${extensions}}`), '**/{node_modules,dist,dist-*,.weapp-vite,miniprogram_npm}/**')
    for (const uri of files) {
      documents.set(uri.fsPath, await vscode.workspace.openTextDocument(uri))
    }
  }
  documents.set(origin.document.uri.fsPath, origin.document)
  for (const document of documents.values()) {
    if (document.uri.fsPath.endsWith('.vue') || TEMPLATE_EXTENSIONS.some(extension => document.uri.fsPath.endsWith(extension))) {
      for (const module of await getTemplateModules(document)) {
        add({ document: module.script, analysis: module.analysis, offset: module.scriptOffset, input: module.input })
      }
    }
    else {
      add(await getScriptModel(document))
    }
  }
  while (pending.length) {
    const model = pending.shift()!
    for (const source of new Set(model.analysis.references.map(reference => reference.source))) {
      const target = await resolveLanguageProjectReference(model.document, source)
      if (target && !result.has(`${target}:0`)) {
        add(await getScriptModel(await vscode.workspace.openTextDocument(vscode.Uri.file(target))))
      }
    }
  }
  return [...result.values()]
}
