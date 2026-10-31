import path from 'node:path'
import { analyzeScript } from '@weapp-vite/language-service'
import * as vscode from 'vscode'
import { isCompletionEnabled, isHoverEnabled, isWxmlDefinitionEnabled } from '../../shared/config'
import { getWxmlInterpolationContext, getWxmlScopedIdentifierMatch, getWxmlSourceText, toWxmlSourceOffset } from '../../template/templateContext'
import { getExpressionIdentifiers } from '../../template/templateIdentifiers'
import { getScriptRenameEdits, isScriptIdentifierName } from '../scriptEdits'
import { scriptTargetCompletionNames } from '../scripts/exports'
import { resolveExternalScriptTarget } from '../scripts/model'
import { externalScriptLocation, publicScriptLocations, renamePublicScriptTarget } from '../scripts/providers'
import { publicScriptRenameEdits } from '../scripts/references'
import { getModuleExports } from './members'
import { editorRange, findModuleTarget, getModuleUses, getTemplateModules, scriptSymbolLocation } from './model'
import { getRelatedModuleUses } from './related'

/** 模板内模块的别名与公开成员直接使用共享脚本分析结果。 */
export class TemplateModuleProviders implements vscode.CompletionItemProvider, vscode.HoverProvider, vscode.DefinitionProvider, vscode.ReferenceProvider, vscode.RenameProvider {
  async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    if (!isCompletionEnabled()) {
      return []
    }
    const modules = await getTemplateModules(document)
    const documentOffset = document.offsetAt(position)
    const inline = modules.find(module => module.script.uri.fsPath === document.uri.fsPath && module.scriptOffset <= documentOffset && documentOffset <= module.scriptEnd)
    if (inline) {
      const offset = documentOffset - inline.scriptOffset
      const prefix = inline.input.source.slice(0, offset)
      if (/(?:\?\.|\.)[$\p{ID_Continue}]*$/u.test(prefix)) {
        const analyzed = analyzeScript({ ...inline.input, source: `${prefix}__weappCompletion${inline.input.source.slice(offset)}` })
        const use = analyzed.externalUses.find(use => use.kind === 'member' && use.start <= offset && offset < use.end)
        const target = use && await resolveExternalScriptTarget({ document, analysis: inline.analysis, offset: inline.scriptOffset, input: inline.input }, { ...use, imported: '*' })
        if (target) {
          return scriptTargetCompletionNames(target, use?.targetPath?.slice(0, -1)).map(name => new vscode.CompletionItem(name, vscode.CompletionItemKind.Function))
        }
      }
      return [...new Set(inline.analysis.symbols.filter(symbol => symbol.kind === 'declaration').map(symbol => symbol.name))].map(name => new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable))
    }
    const source = getWxmlSourceText(document)
    const offset = toWxmlSourceOffset(document, position)
    if (offset == null) {
      return []
    }
    const expression = getWxmlInterpolationContext(source, offset, document.uri.fsPath)
    if (!expression) {
      return []
    }
    const prefix = source.slice(expression.start, offset)
    const member = /([$_\p{ID_Start}][$\p{ID_Continue}]*)((?:\s*\.\s*[$_\p{ID_Start}][$\p{ID_Continue}]*)*)\s*\.\s*[$\p{ID_Continue}]*$/u.exec(prefix)
    if (member) {
      const module = modules.find(module => module.name === member[1])
      const moduleStart = expression.start + member.index
      const complete = `${prefix}__weappCompletion`
      const identifier = getExpressionIdentifiers(complete, expression.start).find(identifier => identifier.start === moduleStart && identifier.name === member[1])
      if (!module || !identifier || identifier.declaration || getWxmlScopedIdentifierMatch(source, moduleStart, module.name, document.uri.fsPath)) {
        return []
      }
      const path = member[2].match(/[$_\p{ID_Start}][$\p{ID_Continue}]*/gu) ?? []
      return getModuleExports(module).filter(item => item.path.length === path.length + 1 && path.every((name, index) => item.path[index] === name)).map((exported) => {
        const item = new vscode.CompletionItem(exported.path.at(-1)!, vscode.CompletionItemKind.Function)
        item.detail = `module ${module.name}`
        return item
      })
    }
    return modules.filter(module => !getWxmlScopedIdentifierMatch(source, offset, module.name, document.uri.fsPath)).map((module) => {
      const item = new vscode.CompletionItem(module.name, vscode.CompletionItemKind.Module)
      item.detail = 'template script module'
      return item
    })
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position) {
    if (!isHoverEnabled()) {
      return null
    }
    const target = findModuleTarget(document, await getTemplateModules(document), document.offsetAt(position))
    if (!target) {
      return null
    }
    if (target.external) {
      const dependency = await resolveExternalScriptTarget({ document: target.module.script, analysis: target.module.analysis, offset: target.module.scriptOffset, input: target.module.input }, target.external)
      if (dependency) {
        return new vscode.Hover(new vscode.MarkdownString(`模块导出 \`${dependency.name}\`\n\n来源：\`${path.basename(dependency.model.document.uri.fsPath)}\``), editorRange(document, target.range.start, target.range.end))
      }
    }
    const title = target.local?.name ?? (target.symbol ? `${target.module.name}.${target.symbol.name}` : target.module.name)
    return new vscode.Hover(new vscode.MarkdownString(`脚本模块 \`${title}\`\n\n来源：\`${path.basename(target.module.script.uri.fsPath)}\``), editorRange(document, target.range.start, target.range.end))
  }

  async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    if (!isWxmlDefinitionEnabled()) {
      return null
    }
    const target = findModuleTarget(document, await getTemplateModules(document), document.offsetAt(position))
    if (!target) {
      return null
    }
    if (target.external) {
      const dependency = await resolveExternalScriptTarget({ document: target.module.script, analysis: target.module.analysis, offset: target.module.scriptOffset, input: target.module.input }, target.external)
      if (dependency) {
        return externalScriptLocation(dependency)
      }
    }
    return target.symbol || target.local
      ? scriptSymbolLocation(target.module, (target.symbol ?? target.local)!)
      : new vscode.Location(document.uri, editorRange(document, target.module.alias.start, target.module.alias.end))
  }

  async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext) {
    const modules = await getTemplateModules(document)
    const target = findModuleTarget(document, modules, document.offsetAt(position))
    if (!target) {
      return []
    }
    if (target.external && target.external.kind !== 'binding') {
      const dependency = await resolveExternalScriptTarget({ document: target.module.script, analysis: target.module.analysis, offset: target.module.scriptOffset, input: target.module.input }, target.external)
      return dependency ? publicScriptLocations(dependency, context.includeDeclaration) : []
    }
    if (target.local) {
      const declaration = target.local.declaration ?? target.local
      return target.module.analysis.symbols.filter((symbol) => {
        const owner = symbol.declaration ?? symbol
        return symbol.name === target.local!.name && owner.start === declaration.start && owner.end === declaration.end && (context.includeDeclaration || symbol.kind !== 'declaration')
      }).map(symbol => scriptSymbolLocation(target.module, symbol, false))
    }
    const locations = target.symbol
      ? (await getRelatedModuleUses(target.module, target.symbol)).map(use => new vscode.Location(use.document.uri, editorRange(use.document, use.start, use.end)))
      : getModuleUses(document, modules).filter(use => use.module.name === target.module.name).map(use => new vscode.Location(document.uri, editorRange(document, use.start, use.end)))
    if (context.includeDeclaration) {
      locations.unshift(target.symbol ? scriptSymbolLocation(target.module, target.symbol, false) : new vscode.Location(document.uri, editorRange(document, target.module.alias.start, target.module.alias.end)))
    }
    return locations
  }

  async prepareRename(document: vscode.TextDocument, position: vscode.Position) {
    const target = findModuleTarget(document, await getTemplateModules(document), document.offsetAt(position))
    if (target?.external && target.external.kind !== 'binding') {
      const dependency = await resolveExternalScriptTarget({ document: target.module.script, analysis: target.module.analysis, offset: target.module.scriptOffset, input: target.module.input }, target.external)
      return dependency?.symbol?.rename && dependency.scope !== 'default' ? { range: editorRange(document, target.range.start, target.range.end), placeholder: dependency.name } : null
    }
    return target && (!target.local || target.local.rename) && (!target.symbol || target.symbol.rename)
      ? { range: editorRange(document, target.range.start, target.range.end), placeholder: target.local?.name ?? target.symbol?.name ?? target.module.name }
      : null
  }

  async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string) {
    if (!isScriptIdentifierName(newName)) {
      return null
    }
    const modules = await getTemplateModules(document)
    const target = findModuleTarget(document, modules, document.offsetAt(position))
    if (!target || (!target.symbol && !target.local && !target.external && modules.some(module => module.name === newName && module.name !== target.module.name))) {
      return null
    }
    const edit = new vscode.WorkspaceEdit()
    if (target.external && target.external.kind !== 'binding') {
      const dependency = await resolveExternalScriptTarget({ document: target.module.script, analysis: target.module.analysis, offset: target.module.scriptOffset, input: target.module.input }, target.external)
      return dependency ? renamePublicScriptTarget(dependency, newName) : null
    }
    if (target.symbol) {
      // 公开导出重命名由 AST 的导出编辑策略处理，避免破坏 shorthand 的本地绑定。
      return this.renameExport(target, newName)
    }
    if (target.local) {
      const changes = getScriptRenameEdits(target.module.analysis, target.local, newName)
      if (!changes) {
        return null
      }
      for (const change of changes) {
        edit.replace(document.uri, editorRange(document, target.module.scriptOffset + change.start, target.module.scriptOffset + change.end), change.text)
      }
      return edit
    }
    if (getModuleUses(document, modules).some(use => use.module.name === target.module.name && getWxmlScopedIdentifierMatch(getWxmlSourceText(document), toWxmlSourceOffset(document, document.positionAt(use.start)) ?? use.start, newName, document.uri.fsPath))) {
      return null
    }
    edit.replace(document.uri, editorRange(document, target.module.alias.start, target.module.alias.end), newName)
    for (const use of getModuleUses(document, modules).filter(use => use.module.name === target.module.name)) {
      edit.replace(document.uri, editorRange(document, use.start, use.end), newName)
    }
    return edit
  }

  private async renameExport(target: NonNullable<ReturnType<typeof findModuleTarget>>, newName: string): Promise<vscode.WorkspaceEdit | null> {
    if (!target.symbol || target.module.analysis.symbols.some(symbol => symbol.kind === 'export' && symbol.exportScope === target.symbol.exportScope && symbol.name === newName && symbol.name !== target.symbol.name)) {
      return null
    }
    const scriptEdits = await publicScriptRenameEdits({ document: target.module.script, analysis: target.module.analysis, offset: target.module.scriptOffset, input: target.module.input }, target.symbol, newName)
    if (!scriptEdits) {
      return null
    }
    const edit = new vscode.WorkspaceEdit()
    for (const change of scriptEdits) {
      edit.replace(change.document.uri, editorRange(change.document, change.start, change.end), change.text)
    }
    for (const use of await getRelatedModuleUses(target.module, target.symbol)) {
      edit.replace(use.document.uri, editorRange(use.document, use.start, use.end), newName)
    }
    return edit
  }
}
