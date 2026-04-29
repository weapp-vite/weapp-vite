import * as vscode from 'vscode'

import {
  isStandaloneWxmlEnhancementEnabled,
  isTemplateDecorationEnabled,
  isVueTemplateWxmlEnhancementEnabled,
  isWxmlEnhancementEnabled,
} from '../shared/config'
import {
  getWxmlSourceText,
  isWxmlDocument,
  toDocumentOffsetFromWxmlSource,
} from './templateContext'
import {
  getTemplateStyleClassMatches,
  isRecognizedWeappVueDocument,
  isRecognizedWeappWxmlDocument,
} from './templateProjectIndex'

const COMMENT_PATTERN = /<!--[\s\S]*?-->/gu
const EVENT_HANDLER_PATTERN = /(?:bind|catch|capture-bind|capture-catch|mut-bind|@)[\w:-]*\s*=\s*("([^"]*)"|'([^']*)')/gu
const SIMPLE_INTERPOLATION_PATTERN = /\{\{\s*([$A-Z_a-z][\w$]*(?:\[\d+\]|\.[A-Z_a-z$][\w$]*)*)\s*\}\}/gu
const CLASS_ATTRIBUTE_PATTERN = /(?:^|[\s<])([@:\w-]*class)\s*=\s*("([^"]*)"|'([^']*)')/gu
const TEMPLATE_EXPRESSION_PATTERN = /\{\{[\s\S]*?\}\}/gu
const CLASS_NAME_PATTERN = /[_a-zA-Z][\w-]*/gu

interface SourceRange {
  end: number
  start: number
}

function toSourceRange(start: number, end: number): SourceRange {
  return {
    end,
    start,
  }
}

function isRangeInside(ranges: SourceRange[], target: SourceRange) {
  return ranges.some(range => target.start >= range.start && target.end <= range.end)
}

function isClassAttributeName(attributeName: string) {
  return attributeName === 'class' || attributeName.endsWith('-class')
}

function collectCommentRanges(sourceText: string) {
  const commentRanges: SourceRange[] = []

  COMMENT_PATTERN.lastIndex = 0
  for (let match = COMMENT_PATTERN.exec(sourceText); match; match = COMMENT_PATTERN.exec(sourceText)) {
    const start = match.index ?? 0
    commentRanges.push(toSourceRange(start, start + match[0].length))
  }

  return commentRanges
}

export function collectTemplateDecorationSourceRanges(sourceText: string) {
  const commentRanges = collectCommentRanges(sourceText)
  const ranges: SourceRange[] = []

  EVENT_HANDLER_PATTERN.lastIndex = 0
  for (let match = EVENT_HANDLER_PATTERN.exec(sourceText); match; match = EVENT_HANDLER_PATTERN.exec(sourceText)) {
    const rawValue = match[2] ?? match[3] ?? ''
    const valueOffset = match[0].lastIndexOf(rawValue)

    if (!rawValue || valueOffset < 0) {
      continue
    }

    const start = (match.index ?? 0) + valueOffset
    const range = toSourceRange(start, start + rawValue.length)

    if (!isRangeInside(commentRanges, range)) {
      ranges.push(range)
    }
  }

  SIMPLE_INTERPOLATION_PATTERN.lastIndex = 0
  for (let match = SIMPLE_INTERPOLATION_PATTERN.exec(sourceText); match; match = SIMPLE_INTERPOLATION_PATTERN.exec(sourceText)) {
    const expression = match[1]
    const expressionOffset = match[0].indexOf(expression)

    if (!expression || expressionOffset < 0) {
      continue
    }

    const start = (match.index ?? 0) + expressionOffset
    const range = toSourceRange(start, start + expression.length)

    if (!isRangeInside(commentRanges, range)) {
      ranges.push(range)
    }
  }

  return ranges
}

export function collectTemplateClassSourceRanges(sourceText: string, definedClassNames: Set<string>) {
  const commentRanges = collectCommentRanges(sourceText)
  const ranges: SourceRange[] = []

  CLASS_ATTRIBUTE_PATTERN.lastIndex = 0
  for (let match = CLASS_ATTRIBUTE_PATTERN.exec(sourceText); match; match = CLASS_ATTRIBUTE_PATTERN.exec(sourceText)) {
    const attributeName = match[1] ?? ''
    const rawValue = match[2] ?? ''
    const value = match[3] ?? match[4] ?? ''
    const valueOffset = match[0].lastIndexOf(rawValue) + 1
    const matchIndex = match.index ?? -1

    if (
      !isClassAttributeName(attributeName)
      || !value
      || valueOffset <= 0
      || matchIndex < 0
    ) {
      continue
    }

    const valueStart = matchIndex + valueOffset
    const valueRanges = [toSourceRange(valueStart, valueStart + value.length)]

    TEMPLATE_EXPRESSION_PATTERN.lastIndex = 0
    for (let expressionMatch = TEMPLATE_EXPRESSION_PATTERN.exec(value); expressionMatch; expressionMatch = TEMPLATE_EXPRESSION_PATTERN.exec(value)) {
      const expressionStart = valueStart + (expressionMatch.index ?? 0)
      valueRanges.push(toSourceRange(expressionStart, expressionStart + expressionMatch[0].length))
    }

    CLASS_NAME_PATTERN.lastIndex = 0
    for (let classMatch = CLASS_NAME_PATTERN.exec(value); classMatch; classMatch = CLASS_NAME_PATTERN.exec(value)) {
      const className = classMatch[0]

      if (!definedClassNames.has(className)) {
        continue
      }

      const start = valueStart + (classMatch.index ?? 0)
      const range = toSourceRange(start, start + className.length)

      if (
        !isRangeInside(commentRanges, range)
        && !valueRanges.slice(1).some(expressionRange => isRangeInside([expressionRange], range))
      ) {
        ranges.push(range)
      }
    }
  }

  return ranges
}

function toDocumentRange(document: vscode.TextDocument, range: SourceRange) {
  const documentStart = toDocumentOffsetFromWxmlSource(document, range.start)
  const documentEnd = toDocumentOffsetFromWxmlSource(document, range.end)

  if (documentStart == null || documentEnd == null) {
    return null
  }

  return new vscode.Range(
    document.positionAt(documentStart),
    document.positionAt(documentEnd),
  )
}

export function collectTemplateDecorationRanges(document: vscode.TextDocument) {
  const sourceText = getWxmlSourceText(document)

  if (!sourceText) {
    return []
  }

  return collectTemplateDecorationSourceRanges(sourceText)
    .map(range => toDocumentRange(document, range))
    .filter((range): range is vscode.Range => Boolean(range))
}

export async function collectDefinedTemplateClassDecorationRanges(document: vscode.TextDocument) {
  const sourceText = getWxmlSourceText(document)

  if (!sourceText) {
    return []
  }

  const definedClassNames = new Set(
    (await getTemplateStyleClassMatches(document))
      .map(match => match.className),
  )

  if (definedClassNames.size === 0) {
    return []
  }

  return collectTemplateClassSourceRanges(sourceText, definedClassNames)
    .map(range => toDocumentRange(document, range))
    .filter((range): range is vscode.Range => Boolean(range))
}

export async function isDecorationEnabledForDocument(document: vscode.TextDocument) {
  if (!isWxmlEnhancementEnabled() || !isTemplateDecorationEnabled()) {
    return false
  }

  if (isWxmlDocument(document)) {
    if (!isStandaloneWxmlEnhancementEnabled()) {
      return false
    }

    return isRecognizedWeappWxmlDocument(document)
  }

  if (document.languageId !== 'vue') {
    return false
  }

  if (!isVueTemplateWxmlEnhancementEnabled()) {
    return false
  }

  return isRecognizedWeappVueDocument(document)
}

export class TemplateDecorationController implements vscode.Disposable {
  private decorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('symbolIcon.variableForeground'),
  })

  private classDecorationType = vscode.window.createTextEditorDecorationType({
    borderColor: new vscode.ThemeColor('editorLink.activeForeground'),
    borderStyle: 'dotted',
    borderWidth: '0 0 1px 0',
  })

  private pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

  private disposables: vscode.Disposable[] = []

  constructor() {
    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        for (const editor of editors) {
          this.scheduleEditorUpdate(editor)
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.scheduleEditorUpdate(editor)
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document === event.document) {
            this.scheduleEditorUpdate(editor, 150)
          }
        }
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        const key = document.uri.toString()
        const timer = this.pendingTimers.get(key)

        if (timer) {
          clearTimeout(timer)
          this.pendingTimers.delete(key)
        }
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration('weapp-vite.enableTemplateDecorations')
          || event.affectsConfiguration('weapp-vite.enableWxmlEnhancements')
          || event.affectsConfiguration('weapp-vite.enableVueTemplateWxmlEnhancements')
          || event.affectsConfiguration('weapp-vite.enableStandaloneWxmlEnhancements')
        ) {
          this.refreshVisibleEditors()
        }
      }),
    )

    this.refreshVisibleEditors()
    this.scheduleEditorUpdate(vscode.window.activeTextEditor)
  }

  dispose() {
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer)
    }

    this.pendingTimers.clear()
    this.decorationType.dispose()
    this.classDecorationType.dispose()
    vscode.window.visibleTextEditors.forEach((editor) => {
      editor.setDecorations(this.decorationType, [])
      editor.setDecorations(this.classDecorationType, [])
    })
    this.disposables.forEach(disposable => disposable.dispose())
    this.disposables = []
  }

  private refreshVisibleEditors() {
    for (const editor of vscode.window.visibleTextEditors) {
      this.scheduleEditorUpdate(editor)
    }
  }

  private scheduleEditorUpdate(editor: vscode.TextEditor | undefined, delay = 0) {
    if (!editor) {
      return
    }

    const key = editor.document.uri.toString()
    const existingTimer = this.pendingTimers.get(key)

    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.pendingTimers.delete(key)
      void this.updateEditor(editor)
    }, delay)

    this.pendingTimers.set(key, timer)
  }

  private async updateEditor(editor: vscode.TextEditor) {
    if (!(await isDecorationEnabledForDocument(editor.document))) {
      editor.setDecorations(this.decorationType, [])
      editor.setDecorations(this.classDecorationType, [])
      return
    }

    editor.setDecorations(this.decorationType, collectTemplateDecorationRanges(editor.document))
    editor.setDecorations(this.classDecorationType, await collectDefinedTemplateClassDecorationRanges(editor.document))
  }
}
