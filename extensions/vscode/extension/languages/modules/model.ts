import type { DocumentInput, ScriptAnalysis, ScriptExternalUse, ScriptSymbol, SourceRange } from '@weapp-vite/language-service'
import type { ModuleMember } from './members'
import { analyzeScript, getTemplateScriptInput } from '@weapp-vite/language-service'
import * as vscode from 'vscode'
import { isStandaloneWxmlEnhancementEnabled, isVueTemplateWxmlEnhancementEnabled, isWxmlEnhancementEnabled } from '../../shared/config'
import { getTemplateAnalysis } from '../../template/templateAnalysis'
import { getWxmlScopedIdentifierMatch, getWxmlSourceText, toDocumentOffsetFromWxmlSource } from '../../template/templateContext'
import { getExpressionIdentifiers } from '../../template/templateIdentifiers'
import { isVueSourceDocument } from '../../template/templateLanguages'
import { getLanguageDocumentInput } from '../documents'
import { resolveLanguageProjectReference } from '../project'
import { externalUseAt } from '../scripts/selection'
import { findModuleExport, getStaticModuleMembers } from './members'

export interface TemplateModule {
  name: string
  alias: SourceRange
  template: vscode.TextDocument
  script: vscode.TextDocument
  scriptOffset: number
  scriptEnd: number
  analysis: ScriptAnalysis
  input: DocumentInput
}

export interface ModuleUse extends SourceRange {
  module: TemplateModule
  members: ModuleMember[]
}

export interface ModuleTarget {
  module: TemplateModule
  range: SourceRange
  symbol?: ScriptSymbol
  local?: ScriptSymbol
  external?: ScriptExternalUse
}

export function editorRange(document: vscode.TextDocument, start: number, end: number) {
  return new vscode.Range(document.positionAt(start), document.positionAt(end))
}

/** 以模板声明与平台 profile 解析模块，不执行模块源码。 */
export async function getTemplateModules(document: vscode.TextDocument) {
  const vue = isVueSourceDocument(document)
  if (!isWxmlEnhancementEnabled() || (vue ? !isVueTemplateWxmlEnhancementEnabled() : !isStandaloneWxmlEnhancementEnabled())) {
    return []
  }
  await getLanguageDocumentInput(document)
  const source = vue ? document.getText() : getWxmlSourceText(document)
  if (source === null) {
    return []
  }
  const documentOffset = (offset: number) => vue ? offset : toDocumentOffsetFromWxmlSource(document, offset) ?? offset
  const template = getTemplateAnalysis(source, document.uri.fsPath)
  const modules = new Map<string, TemplateModule>()
  for (const reference of template.references.filter(reference => reference.kind === 'script-module')) {
    const tag = template.elements.find(element => element.start <= reference.start && reference.end <= element.end)
    if (!tag) {
      continue
    }
    const imported = template.references.find(candidate => candidate.kind === 'script-import' && tag.start <= candidate.start && candidate.end <= tag.end)
    const inline = template.scripts.find(script => script.start === tag.end)
    let script = document
    let scriptOffset = 0
    let scriptSource: string
    let input: DocumentInput
    if (imported) {
      const target = await resolveLanguageProjectReference(document, imported.source ?? imported.name)
      if (!target) {
        continue
      }
      try {
        script = await vscode.workspace.openTextDocument(vscode.Uri.file(target))
      }
      catch {
        continue
      }
      scriptSource = script.getText()
      const external = await getLanguageDocumentInput(script)
      input = { ...external, platform: external.platform ?? template.platform, sourceKind: imported.sourceKind ?? external.sourceKind, language: imported.language ?? external.language }
    }
    else if (inline) {
      scriptSource = inline.source
      scriptOffset = documentOffset(inline.start)
      input = getTemplateScriptInput(document.uri.fsPath, inline, template.platform)
    }
    else {
      continue
    }
    modules.set(reference.name, {
      name: reference.name,
      alias: {
        start: documentOffset(reference.start),
        end: documentOffset(reference.end),
      },
      template: document,
      script,
      scriptOffset,
      scriptEnd: scriptOffset + scriptSource.length,
      analysis: analyzeScript(input),
      input,
    })
  }
  return [...modules.values()]
}

/** 只收集真实表达式中的模块根标识符，排除字符串、注释和循环遮蔽。 */
export function getModuleUses(document: vscode.TextDocument, modules: TemplateModule[]): ModuleUse[] {
  const source = getWxmlSourceText(document)
  if (source === null) {
    return []
  }
  const template = getTemplateAnalysis(source, document.uri.fsPath)
  const uses: ModuleUse[] = []
  for (const expression of template.expressions) {
    for (const identifier of getExpressionIdentifiers(expression.source, expression.start)) {
      const module = modules.find(module => module.name === identifier.name)
      if (!module || identifier.declaration || getWxmlScopedIdentifierMatch(source, identifier.start, identifier.name, document.uri.fsPath)) {
        continue
      }
      const members = getStaticModuleMembers(source.slice(0, expression.end), identifier.end).map(member => ({
        name: member.name,
        start: toDocumentOffsetFromWxmlSource(document, member.start) ?? member.start,
        end: toDocumentOffsetFromWxmlSource(document, member.end) ?? member.end,
      }))
      const start = toDocumentOffsetFromWxmlSource(document, identifier.start) ?? identifier.start
      const end = toDocumentOffsetFromWxmlSource(document, identifier.end) ?? identifier.end
      uses.push({
        start,
        end,
        module,
        members,
      })
    }
  }
  return uses
}

export function findModuleTarget(document: vscode.TextDocument, modules: TemplateModule[], offset: number): ModuleTarget | undefined {
  const declaration = modules.find(module => module.alias.start <= offset && offset <= module.alias.end)
  if (declaration) {
    return { module: declaration, range: declaration.alias }
  }
  const inline = modules.find(module => module.script.uri.fsPath === document.uri.fsPath && module.scriptOffset <= offset && offset <= module.scriptEnd)
  if (inline) {
    const localOffset = offset - inline.scriptOffset
    const external = externalUseAt({ analysis: inline.analysis, offset: inline.scriptOffset }, offset)
    if (external && external.kind !== 'binding') {
      return { module: inline, range: { start: inline.scriptOffset + external.start, end: inline.scriptOffset + external.end }, external }
    }
    const symbols = inline.analysis.symbols.filter(symbol => symbol.start <= localOffset && localOffset <= symbol.end)
    const symbol = symbols.find(symbol => symbol.kind === 'export') ?? symbols[0]
    if (symbol) {
      return {
        module: inline,
        range: { start: inline.scriptOffset + symbol.start, end: inline.scriptOffset + symbol.end },
        ...(symbol.kind === 'export' ? { symbol } : { local: symbol }),
        ...(external ? { external } : {}),
      }
    }
  }
  const use = getModuleUses(document, modules).find(use => use.start <= offset && offset <= (use.members.at(-1)?.end ?? use.end))
  if (!use) {
    return undefined
  }
  const memberIndex = use.members.findIndex(member => member.start <= offset && offset <= member.end)
  if (memberIndex >= 0) {
    const exported = findModuleExport(use.module, use.members.slice(0, memberIndex + 1).map(member => member.name))
    return exported ? { module: use.module, range: use.members[memberIndex], symbol: exported.symbol } : undefined
  }
  if (offset > use.end) {
    return undefined
  }
  return { module: use.module, range: { start: use.start, end: use.end } }
}

export function scriptSymbolLocation(module: TemplateModule, symbol: ScriptSymbol, implementation = true) {
  const target = implementation ? symbol.declaration ?? symbol : symbol
  return new vscode.Location(module.script.uri, editorRange(module.script, module.scriptOffset + target.start, module.scriptOffset + target.end))
}
