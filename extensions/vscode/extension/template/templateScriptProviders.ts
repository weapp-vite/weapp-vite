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
  getTemplateComponentMemberRenameText,
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

export class WeappTemplateScriptRenameProvider implements vscode.RenameProvider {
  async prepareRename(document: vscode.TextDocument, position: vscode.Position) {
    if (!(await isEnabledForScriptDocument(document))) {
      return null
    }

    const targetReference = getTemplateComponentMemberReferenceAtOffset(
      document.getText(),
      document.offsetAt(position),
    )

    if (!targetReference) {
      return null
    }

    return {
      placeholder: targetReference.sourceName,
      range: new vscode.Range(
        document.positionAt(targetReference.definitionStart),
        document.positionAt(targetReference.definitionEnd),
      ),
    }
  }

  async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string) {
    if (!(await isEnabledForScriptDocument(document))) {
      return null
    }

    const targetReference = getTemplateComponentMemberReferenceAtOffset(
      document.getText(),
      document.offsetAt(position),
    )

    if (!targetReference) {
      return null
    }

    const isValidName = targetReference.kind === 'event'
      ? /^[A-Za-z_$][\w$:-]*$/u.test(newName)
      : /^[A-Za-z_$][\w$-]*$/u.test(newName)

    if (!isValidName) {
      return null
    }

    const {
      definitionText,
      templateText,
    } = getTemplateComponentMemberRenameText(targetReference, newName)
    const edit = new vscode.WorkspaceEdit()
    const seenEdits = new Set<string>()
    const addEdit = (targetDocument: vscode.TextDocument, start: number, end: number, text: string) => {
      const filePath = targetDocument.uri.fsPath
      const key = `${filePath}:${start}:${end}:${text}`

      if (seenEdits.has(key)) {
        return
      }

      seenEdits.add(key)
      edit.replace(
        vscode.Uri.file(filePath),
        new vscode.Range(targetDocument.positionAt(start), targetDocument.positionAt(end)),
        text,
      )
    }

    addEdit(
      document,
      targetReference.definitionStart,
      targetReference.definitionEnd,
      definitionText,
    )

    const documentCache = new Map<string, vscode.TextDocument>([[document.uri.fsPath, document]])

    for (const fileRange of await getTemplateComponentMemberUsageRanges(document, targetReference)) {
      const targetDocument = fileRange.filePath === document.uri.fsPath
        ? document
        : await openDocumentByPath(fileRange.filePath, documentCache)

      addEdit(
        targetDocument,
        fileRange.start,
        fileRange.end,
        templateText,
      )
    }

    return edit
  }
}
