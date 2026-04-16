import * as vscode from 'vscode'

import {
  isStandaloneWxmlEnhancementEnabled,
  isTemplateDecorationEnabled,
  isVueTemplateWxmlEnhancementEnabled,
  isWxmlEnhancementEnabled,
} from './config'
import {
  getWxmlSourceText,
  isWxmlDocument,
  toDocumentOffsetFromWxmlSource,
} from './templateContext'
import {
  isRecognizedWeappVueDocument,
  isRecognizedWeappWxmlDocument,
} from './templateProjectIndex'

const COMMENT_PATTERN = /<!--[\s\S]*?-->/gu
const EVENT_HANDLER_PATTERN = /(?:bind|catch|capture-bind|capture-catch|mut-bind|@)[\w:-]*\s*=\s*("([^"]*)"|'([^']*)')/gu
const SIMPLE_INTERPOLATION_PATTERN = /\{\{\s*([$A-Z_a-z][\w$]*(?:\[\d+\]|\.[A-Z_a-z$][\w$]*)*)\s*\}\}/gu

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

export function collectTemplateDecorationSourceRanges(sourceText: string) {
  const commentRanges: SourceRange[] = []
  const ranges: SourceRange[] = []

  COMMENT_PATTERN.lastIndex = 0
  for (let match = COMMENT_PATTERN.exec(sourceText); match; match = COMMENT_PATTERN.exec(sourceText)) {
    const start = match.index ?? 0
    commentRanges.push(toSourceRange(start, start + match[0].length))
  }

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

export function collectTemplateDecorationRanges(document: vscode.TextDocument) {
  const sourceText = getWxmlSourceText(document)

  if (!sourceText) {
    return []
  }

  return collectTemplateDecorationSourceRanges(sourceText)
    .map((range) => {
      const documentStart = toDocumentOffsetFromWxmlSource(document, range.start)
      const documentEnd = toDocumentOffsetFromWxmlSource(document, range.end)

      if (documentStart == null || documentEnd == null) {
        return null
      }

      return new vscode.Range(
        document.positionAt(documentStart),
        document.positionAt(documentEnd),
      )
    })
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
    vscode.window.visibleTextEditors.forEach(editor => editor.setDecorations(this.decorationType, []))
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
      return
    }

    editor.setDecorations(this.decorationType, collectTemplateDecorationRanges(editor.document))
  }
}
