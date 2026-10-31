import type { ScriptTarget } from './model'
import * as vscode from 'vscode'
import { editorRange } from '../modules/model'
import { getScriptExportUses } from '../modules/related'
import { dependentScriptReferences, publicScriptRenameEdits } from './references'

export function externalScriptLocation(target: ScriptTarget) {
  const symbol = target.symbol?.declaration ?? target.symbol
  return new vscode.Location(target.model.document.uri, editorRange(target.model.document, target.model.offset + (symbol?.start ?? 0), target.model.offset + (symbol?.end ?? 0)))
}

/** 公开符号的引用同时包含 native 依赖与模板使用，本地别名保持自己的绑定身份。 */
export async function publicScriptLocations(target: ScriptTarget, includeDeclaration: boolean) {
  const references: vscode.Location[] = []
  const { model, symbol, name, scope } = target
  if (symbol) {
    const declaration = symbol.declaration ?? symbol
    for (const candidate of model.analysis.symbols) {
      const owner = candidate.declaration ?? candidate
      if (candidate.name === name && (candidate.kind !== 'export' || candidate.exportScope === scope) && owner.start === declaration.start && owner.end === declaration.end
        && (includeDeclaration || (candidate.kind !== 'export' && candidate.kind !== 'declaration'))) {
        references.push(new vscode.Location(model.document.uri, editorRange(model.document, model.offset + candidate.start, model.offset + candidate.end)))
      }
    }
  }
  const dependencies = await dependentScriptReferences(model, name, scope)
  for (const use of [...dependencies.references, ...(includeDeclaration ? dependencies.imports : [])]) {
    references.push(new vscode.Location(use.document.uri, editorRange(use.document, use.start, use.end)))
  }
  if (model.offset === 0) {
    for (const use of await getScriptExportUses(model.document, name, scope)) {
      references.push(new vscode.Location(use.document.uri, editorRange(use.document, use.start, use.end)))
    }
  }
  return [...new Map(references.map(location => [`${location.uri.fsPath}:${location.range.start.line}:${location.range.start.character}`, location])).values()]
}

export async function renamePublicScriptTarget(target: ScriptTarget, name: string) {
  if (!target.symbol || target.scope === 'default') {
    return null
  }
  const changes = await publicScriptRenameEdits(target.model, target.symbol, name)
  if (!changes) {
    return null
  }
  const edit = new vscode.WorkspaceEdit()
  for (const change of changes) {
    edit.replace(change.document.uri, editorRange(change.document, change.start, change.end), change.text)
  }
  if (target.model.offset === 0) {
    for (const use of await getScriptExportUses(target.model.document, target.name, target.scope)) {
      edit.replace(use.document.uri, editorRange(use.document, use.start, use.end), name)
    }
  }
  return edit
}
