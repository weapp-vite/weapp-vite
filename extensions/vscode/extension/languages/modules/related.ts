import type { ScriptExportScope, ScriptSymbol } from '@weapp-vite/language-service'
import type { TemplateModule } from './model'
import { TEMPLATE_EXTENSIONS } from '@weapp-vite/language-service'
import * as vscode from 'vscode'
import { getModuleExportRange } from './members'
import { getModuleUses, getTemplateModules } from './model'

export async function templateDocuments(document: vscode.TextDocument) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri)
  const documents = new Map<string, vscode.TextDocument>()
  if (folder) {
    const extensions = ['vue', ...TEMPLATE_EXTENSIONS.map(extension => extension.slice(1))].join(',')
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, `**/*.{${extensions}}`), '**/{node_modules,dist,dist-*,.weapp-vite,miniprogram_npm}/**')
    for (const uri of files) {
      documents.set(uri.fsPath, await vscode.workspace.openTextDocument(uri))
    }
  }
  return documents
}

/** 从脚本公开导出反查模板，支持从原生模块发起引用与重命名。 */
export async function getScriptExportUses(document: vscode.TextDocument, member: string, scope: ScriptExportScope) {
  const results: Array<{ document: vscode.TextDocument, start: number, end: number }> = []
  for (const template of (await templateDocuments(document)).values()) {
    const modules = await getTemplateModules(template)
    for (const use of getModuleUses(template, modules)) {
      const range = getModuleExportRange(use, member, scope)
      if (use.module.script.uri.fsPath === document.uri.fsPath && use.module.scriptOffset === 0 && range) {
        results.push({ document: template, start: range.start, end: range.end })
      }
    }
  }
  return results
}

/** 在当前工作区查找真实导入同一模块的模板，复用未保存文档而不重写源码。 */
export async function getRelatedModuleUses(module: TemplateModule, symbol?: ScriptSymbol) {
  const documents = new Map<string, vscode.TextDocument>([[module.template.uri.fsPath, module.template]])
  if (module.script.uri.fsPath !== module.template.uri.fsPath) {
    for (const [key, document] of await templateDocuments(module.template)) {
      if (!documents.has(key)) {
        documents.set(key, document)
      }
    }
  }
  const results: Array<{ document: vscode.TextDocument, start: number, end: number }> = []
  const seen = new Set<string>()
  for (const document of documents.values()) {
    const modules = await getTemplateModules(document)
    for (const use of getModuleUses(document, modules)) {
      const member = symbol?.exportScope ? getModuleExportRange(use, symbol.name, symbol.exportScope) : undefined
      if (use.module.script.uri.fsPath !== module.script.uri.fsPath || use.module.scriptOffset !== module.scriptOffset || (symbol && !member)) {
        continue
      }
      const selected = member ?? use
      const key = `${document.uri.fsPath}:${selected.start}:${selected.end}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({ document, start: selected.start, end: selected.end })
      }
    }
  }
  return results
}
