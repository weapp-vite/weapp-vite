import * as vscode from 'vscode'

import {
  getProjectContext,
} from '../project/workspace'
import {
  isStandaloneWxmlEnhancementEnabled,
  isVueTemplateWxmlEnhancementEnabled,
  isWxmlEnhancementEnabled,
} from '../shared/config'
import {
  getTemplateComponentMemberReferenceAtOffset,
  getTemplateComponentMemberUsageRanges,
  isRecognizedWeappVueDocument,
} from './templateProjectIndex'

async function isEnabledForScriptDocument(document: vscode.TextDocument) {
  if (!isWxmlEnhancementEnabled()) {
    return false
  }

  if (document.languageId === 'vue') {
    return isVueTemplateWxmlEnhancementEnabled()
      && await isRecognizedWeappVueDocument(document)
  }

  if (document.languageId !== 'typescript' && document.languageId !== 'javascript') {
    return false
  }

  if (!isStandaloneWxmlEnhancementEnabled()) {
    return false
  }

  return Boolean(await getProjectContext(vscode.workspace.getWorkspaceFolder(document.uri) ?? undefined))
}

async function openDocumentByPath(filePath: string, cache: Map<string, vscode.TextDocument>) {
  let document = cache.get(filePath)

  if (document) {
    return document
  }

  document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath))
  cache.set(filePath, document)

  return document
}

async function readDocumentText(document: vscode.TextDocument, cache: Map<string, string>) {
  let sourceText = cache.get(document.uri.fsPath)

  if (sourceText != null) {
    return sourceText
  }

  sourceText = document.getText()
  cache.set(document.uri.fsPath, sourceText)

  return sourceText
}

async function createLocationFromRange(
  currentDocument: vscode.TextDocument,
  fileRange: { end: number, filePath: string, start: number },
  documentCache: Map<string, vscode.TextDocument>,
  textCache: Map<string, string>,
) {
  const document = fileRange.filePath === currentDocument.uri.fsPath
    ? currentDocument
    : await openDocumentByPath(fileRange.filePath, documentCache)
  const sourceText = await readDocumentText(document, textCache)
  const position = document.positionAt(Math.max(0, Math.min(fileRange.start, sourceText.length)))

  return new vscode.Location(vscode.Uri.file(fileRange.filePath), position)
}

export class WeappTemplateScriptReferenceProvider implements vscode.ReferenceProvider {
  async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext) {
    if (!(await isEnabledForScriptDocument(document))) {
      return []
    }

    const targetReference = getTemplateComponentMemberReferenceAtOffset(
      document.getText(),
      document.offsetAt(position),
    )

    if (!targetReference) {
      return []
    }

    const documentCache = new Map<string, vscode.TextDocument>([[document.uri.fsPath, document]])
    const textCache = new Map<string, string>([[document.uri.fsPath, document.getText()]])
    const locations = await Promise.all(
      (await getTemplateComponentMemberUsageRanges(document, targetReference)).map(fileRange =>
        createLocationFromRange(document, fileRange, documentCache, textCache),
      ),
    )

    if (context.includeDeclaration === false) {
      return locations
    }

    return [
      new vscode.Location(vscode.Uri.file(document.uri.fsPath), document.positionAt(targetReference.definitionStart)),
      ...locations,
    ]
  }
}
