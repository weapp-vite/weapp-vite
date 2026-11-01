import type { ScriptAnalysis, ScriptSymbol } from '@weapp-vite/language-service'
import path from 'node:path'
import { analyzeScript } from '@weapp-vite/language-service'
import * as vscode from 'vscode'
import { getLanguageDocumentInput } from './documents'
import { resolveLanguageProjectReference } from './project'
import { getScriptRenameEdits } from './scriptEdits'
import { scriptTargetCompletionNames } from './scripts/exports'
import { externalUseAt, getScriptModel, resolveExternalScriptTarget } from './scripts/model'
import { externalScriptLocation, publicScriptLocations, renamePublicScriptTarget } from './scripts/providers'

function range(document: vscode.TextDocument, start: number, end: number) {
  return new vscode.Range(document.positionAt(start), document.positionAt(end))
}

function declaration(symbol: ScriptSymbol) {
  return symbol.declaration ?? { start: symbol.start, end: symbol.end }
}

function symbolAt(analysis: ScriptAnalysis, offset: number) {
  const symbols = analysis.symbols.filter(symbol => symbol.start <= offset && offset <= symbol.end)
  return symbols.find(symbol => symbol.kind === 'export') ?? symbols[0]
}

function sameBinding(left: ScriptSymbol, right: ScriptSymbol) {
  const a = declaration(left)
  const b = declaration(right)
  return left.name === right.name && a.start === b.start && a.end === b.end
}

async function analysis(document: vscode.TextDocument) {
  return analyzeScript(await getLanguageDocumentInput(document))
}

/** 独立 WXS/SJS 使用共享作用域分析，避免把宿主 API 或浏览器全局带入模块。 */
export class MiniProgramScriptProviders implements vscode.CompletionItemProvider, vscode.HoverProvider, vscode.DefinitionProvider, vscode.ReferenceProvider, vscode.RenameProvider, vscode.DocumentLinkProvider {
  async provideCompletionItems(document: vscode.TextDocument, position?: vscode.Position) {
    const model = await getScriptModel(document)
    let result = model.analysis
    if (position) {
      const offset = document.offsetAt(position)
      const prefix = document.getText().slice(0, offset)
      if (/(?:\?\.|\.)[$\p{ID_Continue}]*$/u.test(prefix)) {
        const input = await getLanguageDocumentInput(document)
        result = analyzeScript({ ...input, source: `${prefix}__weappCompletion${document.getText().slice(offset)}` })
        const use = result.externalUses.find(use => use.kind === 'member' && use.start <= offset && offset < use.end)
        if (use) {
          const dependency = await resolveExternalScriptTarget(model, { ...use, imported: '*' })
          if (dependency) {
            return scriptTargetCompletionNames(dependency, use.targetPath?.slice(0, -1)).map(name => new vscode.CompletionItem(name, vscode.CompletionItemKind.Function))
          }
        }
      }
    }
    const names = [...new Set(result.symbols.filter(symbol => symbol.kind !== 'reference').map(symbol => symbol.name))]
    return names.map((name) => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable)
      item.detail = 'script module binding'
      return item
    })
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position) {
    const model = await getScriptModel(document)
    const result = model.analysis
    const use = externalUseAt(model, document.offsetAt(position))
    const external = use && await resolveExternalScriptTarget(model, use)
    if (external) {
      return new vscode.Hover(new vscode.MarkdownString(`模块导出 \`${external.name}\`\n\n来源：\`${path.basename(external.model.document.uri.fsPath)}\``), range(document, use.start, use.end))
    }
    const symbol = symbolAt(result, document.offsetAt(position))
    return symbol ? new vscode.Hover(new vscode.MarkdownString(`模块符号 \`${symbol.name}\`（${result.dialect}）`), range(document, symbol.start, symbol.end)) : null
  }

  async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    const model = await getScriptModel(document)
    const result = model.analysis
    const offset = document.offsetAt(position)
    const reference = result.references.find(reference => reference.start <= offset && offset <= reference.end)
    if (reference) {
      const resolved = await resolveLanguageProjectReference(document, reference.source)
      return resolved ? new vscode.Location(vscode.Uri.file(resolved), new vscode.Position(0, 0)) : null
    }
    const use = externalUseAt(model, offset)
    if (use) {
      const target = await resolveExternalScriptTarget(model, use)
      if (target) {
        return externalScriptLocation(target)
      }
    }
    const symbol = symbolAt(result, offset)
    if (!symbol) {
      return null
    }
    const target = declaration(symbol)
    return new vscode.Location(document.uri, range(document, target.start, target.end))
  }

  async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext) {
    const model = await getScriptModel(document)
    const result = model.analysis
    const use = externalUseAt(model, document.offsetAt(position))
    if (use?.kind === 'member' || use?.kind === 'reexport') {
      const target = await resolveExternalScriptTarget(model, use)
      return target ? publicScriptLocations(target, context.includeDeclaration) : []
    }
    const target = symbolAt(result, document.offsetAt(position))
    if (!target) {
      return []
    }
    const references = result.symbols.filter(symbol => sameBinding(symbol, target) && (context.includeDeclaration || (symbol.kind !== 'declaration' && symbol.kind !== 'export')))
      .map(symbol => new vscode.Location(document.uri, range(document, symbol.start, symbol.end)))
    if (target.kind === 'export' && target.exportScope) {
      return publicScriptLocations({ model, symbol: target, name: target.name, scope: target.exportScope }, context.includeDeclaration)
    }
    return [...new Map(references.map(location => [`${location.uri.fsPath}:${location.range.start.line}:${location.range.start.character}`, location])).values()]
  }

  async prepareRename(document: vscode.TextDocument, position: vscode.Position) {
    const model = await getScriptModel(document)
    const result = model.analysis
    const use = externalUseAt(model, document.offsetAt(position))
    if (use?.kind === 'member' || use?.kind === 'reexport') {
      const target = await resolveExternalScriptTarget(model, use)
      return target?.symbol?.rename && target.scope !== 'default' ? { range: range(document, use.start, use.end), placeholder: target.name } : null
    }
    const symbol = symbolAt(result, document.offsetAt(position))
    return symbol?.rename ? { range: range(document, symbol.start, symbol.end), placeholder: symbol.name } : null
  }

  async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string) {
    const model = await getScriptModel(document)
    const result = model.analysis
    const use = externalUseAt(model, document.offsetAt(position))
    if (use?.kind === 'member' || use?.kind === 'reexport') {
      const target = await resolveExternalScriptTarget(model, use)
      return target ? renamePublicScriptTarget(target, newName) : null
    }
    const target = symbolAt(result, document.offsetAt(position))
    if (!target) {
      return null
    }
    if (target.kind === 'export' && target.exportScope) {
      return renamePublicScriptTarget({ model, symbol: target, name: target.name, scope: target.exportScope }, newName)
    }
    const edit = new vscode.WorkspaceEdit()
    const changes = getScriptRenameEdits(result, target, newName)
    if (!changes) {
      return null
    }
    for (const change of changes) {
      edit.replace(document.uri, range(document, change.start, change.end), change.text)
    }
    return edit
  }

  async provideDocumentLinks(document: vscode.TextDocument) {
    const result = await analysis(document)
    const links = await Promise.all(result.references.map(async (reference) => {
      const target = await resolveLanguageProjectReference(document, reference.source)
      return target ? new vscode.DocumentLink(range(document, reference.start, reference.end), vscode.Uri.file(target)) : undefined
    }))
    return links.filter((link): link is vscode.DocumentLink => Boolean(link))
  }
}
