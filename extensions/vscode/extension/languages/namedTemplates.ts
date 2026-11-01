import type { TemplateReference } from '@weapp-vite/language-service'
import * as vscode from 'vscode'
import { isCompletionEnabled, isHoverEnabled, isStandaloneWxmlEnhancementEnabled, isVueTemplateWxmlEnhancementEnabled, isWxmlDefinitionEnabled, isWxmlEnhancementEnabled } from '../shared/config'
import { getTemplateAnalysis } from '../template/templateAnalysis'
import { getWxmlSourceText, toDocumentOffsetFromWxmlSource } from '../template/templateContext'
import { isVueSourceDocument } from '../template/templateLanguages'
import { resolveTemplateLinkTarget } from '../template/templateProjectIndex'
import { getLanguageDocumentInput } from './documents'
import { editorRange } from './modules/model'
import { templateDocuments } from './modules/related'

interface NamedTemplate {
  document: vscode.TextDocument
  reference: TemplateReference
}

async function metadata(document: vscode.TextDocument) {
  if (!isWxmlEnhancementEnabled() || (isVueSourceDocument(document) ? !isVueTemplateWxmlEnhancementEnabled() : !isStandaloneWxmlEnhancementEnabled())) {
    return getTemplateAnalysis('', document.uri.fsPath)
  }
  await getLanguageDocumentInput(document)
  return getTemplateAnalysis(getWxmlSourceText(document) ?? '', document.uri.fsPath)
}

function range(target: NamedTemplate) {
  return editorRange(target.document, toDocumentOffsetFromWxmlSource(target.document, target.reference.start) ?? target.reference.start, toDocumentOffsetFromWxmlSource(target.document, target.reference.end) ?? target.reference.end)
}

function same(left: NamedTemplate, right: NamedTemplate) {
  return left.document.uri.fsPath === right.document.uri.fsPath && left.reference.start === right.reference.start
}

/** 命名模板只读取本文件与直接 import 的公开声明，不把 include 或传递导入当作重新导出。 */
async function declarations(document: vscode.TextDocument) {
  const local = await metadata(document)
  const result: NamedTemplate[] = local.references.filter(reference => reference.kind === 'template-name').map(reference => ({ document, reference }))
  for (const imported of local.references.filter(reference => reference.kind === 'template-import')) {
    const target = await resolveTemplateLinkTarget(document, 'src', imported.name)
    if (!target) {
      continue
    }
    try {
      const dependency = await vscode.workspace.openTextDocument(vscode.Uri.file(target))
      result.push(...(await metadata(dependency)).references.filter(reference => reference.kind === 'template-name').map(reference => ({ document: dependency, reference })))
    }
    catch {
      // 缺失导入交由路径诊断；编辑器不能据此猜测声明。
    }
  }
  return [...new Map(result.map(target => [`${target.document.uri.fsPath}:${target.reference.start}`, target])).values()]
}

async function targetAt(document: vscode.TextDocument, position: vscode.Position) {
  const offset = document.offsetAt(position)
  const reference = (await metadata(document)).references.find(reference => ['template-name', 'template-use'].includes(reference.kind)
    && (toDocumentOffsetFromWxmlSource(document, reference.start) ?? reference.start) <= offset
    && offset <= (toDocumentOffsetFromWxmlSource(document, reference.end) ?? reference.end))
  if (!reference || reference.name.includes('{{')) {
    return undefined
  }
  const candidates = (await declarations(document)).filter(target => target.reference.name === reference.name)
  return candidates.length === 1 ? { target: candidates[0], selected: { document, reference } } : undefined
}

async function uses(target: NamedTemplate) {
  const documents = await templateDocuments(target.document)
  documents.set(target.document.uri.fsPath, target.document)
  const result: NamedTemplate[] = []
  for (const document of documents.values()) {
    const candidates = (await declarations(document)).filter(candidate => candidate.reference.name === target.reference.name)
    if (candidates.length === 1 && same(candidates[0], target)) {
      result.push(...(await metadata(document)).references.filter(reference => reference.kind === 'template-use' && reference.name === target.reference.name).map(reference => ({ document, reference })))
    }
  }
  return result
}

/** 使用共享模板引用为命名模板提供导航；动态 is 表达式继续交给普通表达式服务。 */
export class NamedTemplateProviders implements vscode.CompletionItemProvider, vscode.HoverProvider, vscode.DefinitionProvider, vscode.ReferenceProvider, vscode.RenameProvider {
  async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    if (!isCompletionEnabled()) {
      return []
    }
    const offset = document.offsetAt(position)
    const selected = (await metadata(document)).references.find(reference => reference.kind === 'template-use'
      && (toDocumentOffsetFromWxmlSource(document, reference.start) ?? reference.start) <= offset
      && offset <= (toDocumentOffsetFromWxmlSource(document, reference.end) ?? reference.end))
    return selected ? (await declarations(document)).map(target => new vscode.CompletionItem(target.reference.name, vscode.CompletionItemKind.Module)) : []
  }

  async provideHover(document: vscode.TextDocument, position: vscode.Position) {
    if (!isHoverEnabled()) {
      return null
    }
    const result = await targetAt(document, position)
    return result ? new vscode.Hover(new vscode.MarkdownString(`命名模板 \`${result.target.reference.name}\``), range(result.selected)) : null
  }

  async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    if (!isWxmlDefinitionEnabled()) {
      return null
    }
    const result = await targetAt(document, position)
    return result ? new vscode.Location(result.target.document.uri, range(result.target)) : null
  }

  async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext) {
    const result = await targetAt(document, position)
    if (!result) {
      return []
    }
    const references = await uses(result.target)
    if (context.includeDeclaration) {
      references.unshift(result.target)
    }
    return references.map(target => new vscode.Location(target.document.uri, range(target)))
  }

  async prepareRename(document: vscode.TextDocument, position: vscode.Position) {
    const result = await targetAt(document, position)
    return result ? { range: range(result.selected), placeholder: result.target.reference.name } : null
  }

  async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string) {
    const result = await targetAt(document, position)
    if (!result || !/^[\p{L}_][\p{L}\p{N}_.-]*$/u.test(newName)) {
      return null
    }
    const references = [result.target, ...await uses(result.target)]
    for (const reference of references) {
      if ((await declarations(reference.document)).some(candidate => candidate.reference.name === newName && !same(candidate, result.target))) {
        return null
      }
    }
    const edit = new vscode.WorkspaceEdit()
    for (const reference of references) {
      edit.replace(reference.document.uri, range(reference), newName)
    }
    return edit
  }
}
