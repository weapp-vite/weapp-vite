import * as vscode from 'vscode'

import {
  isStandaloneWxmlEnhancementEnabled,
  isWxmlEnhancementEnabled,
} from '../shared/config'
import {
  formatWxmlText,
} from './wxmlFormatter'

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
  async provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions) {
    if (!isWxmlEnhancementEnabled() || !isStandaloneWxmlEnhancementEnabled()) {
      return []
    }

    const sourceText = document.getText()
    const formattedText = formatWxmlText(sourceText, {
      indent: getFormatIndent(options),
    })

    if (formattedText === sourceText) {
      return []
    }

    return [{
      range: getFullDocumentRange(sourceText),
      newText: formattedText,
    }]
  }
}
