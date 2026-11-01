import { formatTemplate } from '@weapp-vite/language-service'
import * as vscode from 'vscode'

import { formatProjectDocument, getLanguageDocumentState } from '../languages/project'
import {
  isStandaloneWxmlEnhancementEnabled,
  isWxmlEnhancementEnabled,
} from '../shared/config'

function getLineOffsets(text: string) {
  const lineOffsets = [0]

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      lineOffsets.push(index + 1)
    }
  }

  return lineOffsets
}

function getPositionAt(text: string, offset: number) {
  const lineOffsets = getLineOffsets(text)
  const safeOffset = Math.max(0, Math.min(offset, text.length))
  let line = 0

  while (line + 1 < lineOffsets.length && lineOffsets[line + 1] <= safeOffset) {
    line += 1
  }

  return {
    line,
    character: safeOffset - lineOffsets[line],
  }
}

function getFullDocumentRange(text: string) {
  const end = getPositionAt(text, text.length)
  return new vscode.Range(0, 0, end.line, end.character)
}

function getFormatIndent(options: vscode.FormattingOptions) {
  if (!options.insertSpaces) {
    return '\t'
  }

  return ' '.repeat(Math.max(1, options.tabSize))
}

export class WeappWxmlDocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {
  constructor(private readonly reportError?: (document: vscode.TextDocument, error: unknown) => void) {}

  async provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions) {
    if (!isWxmlEnhancementEnabled() || !isStandaloneWxmlEnhancementEnabled()) {
      return []
    }

    const sourceText = document.getText()
    const version = document.version
    let formattedText: string
    try {
      const { configuration, input } = await getLanguageDocumentState(document)
      formattedText = await formatProjectDocument(document, sourceText, true) ?? formatTemplate(sourceText, input.fileName, {
        indent: configuration?.fmt ? undefined : getFormatIndent(options),
        ...configuration?.fmt,
        ...input.options,
        ...(input.platform ? { platform: input.platform } : {}),
      })
    }
    catch (error) {
      // 不完整输入由共享语言诊断展示；保存格式化不尝试自动修复。
      if (document.version === version) {
        this.reportError?.(document, error)
      }
      return []
    }

    if (formattedText === sourceText || document.version !== version) {
      return []
    }

    return [{
      range: getFullDocumentRange(sourceText),
      newText: formattedText,
    }]
  }
}

/** 原生脚本与样式共用项目格式入口，标准 JS/TS 仍使用 Oxc。 */
export class WeappNativeDocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {
  constructor(private readonly reportError?: (document: vscode.TextDocument, error: unknown) => void) {}

  async provideDocumentFormattingEdits(document: vscode.TextDocument) {
    const sourceText = document.getText()
    const version = document.version
    let formattedText: string
    try {
      formattedText = await formatProjectDocument(document, sourceText)
    }
    catch (error) {
      if (document.version === version) {
        this.reportError?.(document, error)
      }
      return []
    }
    if (formattedText === sourceText || document.version !== version) {
      return []
    }
    return [{ range: getFullDocumentRange(sourceText), newText: formattedText }]
  }
}
