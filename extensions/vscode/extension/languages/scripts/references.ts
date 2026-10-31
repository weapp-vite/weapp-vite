import type { ScriptExportScope, ScriptImportRename, ScriptSymbol, SourceRange } from '@weapp-vite/language-service'
import type * as vscode from 'vscode'
import type { ScriptModel } from './model'
import { resolveLanguageProjectReference } from '../project'
import { getScriptRenameEdits } from '../scriptEdits'
import { matchesImportedScriptSymbol } from './exports'
import { projectScriptModels } from './model'

export interface ProjectScriptEdit extends SourceRange {
  document: vscode.TextDocument
  text: string
}

function renamedImport(name: string, rename?: ScriptImportRename) {
  return rename?.kind === 'import-shorthand'
    ? `${name} as ${rename.localName}`
    : rename?.kind === 'property-shorthand' ? `${name}: ${rename.localName}` : name
}

/** 查找直接静态依赖，保留本地 import/require 别名，成员访问才修改使用处。 */
export async function dependentScriptReferences(target: ScriptModel, name: string, scope: ScriptExportScope) {
  if (target.offset !== 0) {
    return { references: [] as ProjectScriptEdit[], imports: [] as ProjectScriptEdit[] }
  }
  const references: ProjectScriptEdit[] = []
  const imports: ProjectScriptEdit[] = []
  for (const model of await projectScriptModels(target)) {
    const sources = new Map<string, boolean>()
    const owns = async (source: string) => {
      if (!sources.has(source)) {
        sources.set(source, await resolveLanguageProjectReference(model.document, source) === target.document.uri.fsPath)
      }
      return sources.get(source)!
    }
    for (const use of model.analysis.externalUses) {
      if (matchesImportedScriptSymbol(target, use, name, scope) && await owns(use.source)) {
        references.push({ document: model.document, start: model.offset + use.start, end: model.offset + use.end, text: use.kind === 'binding' ? '' : renamedImport(name, use.rename) })
      }
    }
    for (const imported of model.analysis.imports) {
      if (matchesImportedScriptSymbol(target, imported, name, scope) && imported.importedRange && await owns(imported.source)) {
        imports.push({ document: model.document, start: model.offset + imported.importedRange.start, end: model.offset + imported.importedRange.end, text: renamedImport(name, imported.rename) })
      }
    }
  }
  return { references, imports }
}

async function dependentScriptRenameEdits(target: ScriptModel, previous: string, name: string, scope: ScriptExportScope) {
  if (target.offset !== 0) {
    return []
  }
  const edits: ProjectScriptEdit[] = []
  for (const model of await projectScriptModels(target)) {
    const sources = new Map<string, boolean>()
    const owns = async (source: string) => {
      if (!sources.has(source)) {
        sources.set(source, await resolveLanguageProjectReference(model.document, source) === target.document.uri.fsPath)
      }
      return sources.get(source)!
    }
    for (const imported of model.analysis.imports) {
      if (matchesImportedScriptSymbol(target, imported, previous, scope) && imported.importedRange && await owns(imported.source)) {
        edits.push({ document: model.document, start: model.offset + imported.importedRange.start, end: model.offset + imported.importedRange.end, text: renamedImport(name, imported.rename) })
      }
    }
    for (const use of model.analysis.externalUses) {
      if (use.kind !== 'binding' && matchesImportedScriptSymbol(target, use, previous, scope) && await owns(use.source)) {
        edits.push({ document: model.document, start: model.offset + use.start, end: model.offset + use.end, text: renamedImport(name, use.rename) })
      }
    }
  }
  return [...new Map(edits.map(edit => [`${edit.document.uri.fsPath}:${edit.start}:${edit.end}`, edit])).values()]
}

/** 导出改名首先生成本文件 AST 编辑，再生成依赖侧编辑，任何冲突都不返回部分结果。 */
export async function publicScriptRenameEdits(target: ScriptModel, symbol: ScriptSymbol, name: string): Promise<ProjectScriptEdit[] | undefined> {
  if (!symbol.exportScope || target.analysis.symbols.some(candidate => candidate.kind === 'export' && candidate.exportScope === symbol.exportScope && candidate.name === name && candidate.name !== symbol.name)) {
    return undefined
  }
  // 同一属性源码若同时承担多个公开作用域，拒绝只更新其中一侧的部分重命名。
  if (target.analysis.symbols.some(candidate => candidate.kind === 'export' && candidate.start === symbol.start && candidate.end === symbol.end && candidate.exportScope !== symbol.exportScope)) {
    return undefined
  }
  const local = getScriptRenameEdits(target.analysis, symbol, name, true)
  if (!local) {
    return undefined
  }
  const renamed = await dependentScriptRenameEdits(target, symbol.name, name, symbol.exportScope)
  return [...local.map(edit => ({ document: target.document, start: target.offset + edit.start, end: target.offset + edit.end, text: edit.text })), ...renamed]
}
