import * as vscode from 'vscode'

import {
  isStandaloneWxmlEnhancementEnabled,
  isWxmlEnhancementEnabled,
} from '../shared/config'

interface PositionLike {
  line: number
  character: number
}

interface RangeLike {
  start: PositionLike
  end: PositionLike
}

interface TextEditLike {
  range: RangeLike
  newText: string
}

function getLineOffsets(text: string) {
  const lineOffsets = [0]

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      lineOffsets.push(index + 1)
    }
  }

  return lineOffsets
}

function getOffsetAt(text: string, position: PositionLike) {
  const lineOffsets = getLineOffsets(text)
  const safeLine = Math.max(0, Math.min(position.line, lineOffsets.length - 1))
  const lineStart = lineOffsets[safeLine]
  const nextLineStart = lineOffsets[safeLine + 1] ?? text.length
  const lineLength = nextLineStart - lineStart
  const safeCharacter = Math.max(0, Math.min(position.character, lineLength))

  return Math.min(lineStart + safeCharacter, text.length)
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

function applyTextEdits(text: string, edits: readonly TextEditLike[]) {
  const normalizedEdits = edits
    .map(edit => ({
      ...edit,
      startOffset: getOffsetAt(text, edit.range.start),
      endOffset: getOffsetAt(text, edit.range.end),
    }))
    .sort((left, right) => right.startOffset - left.startOffset || right.endOffset - left.endOffset)

  let nextText = text

  for (const edit of normalizedEdits) {
    nextText = `${nextText.slice(0, edit.startOffset)}${edit.newText}${nextText.slice(edit.endOffset)}`
  }

  return nextText
}

function getFullDocumentRange(text: string) {
  const end = getPositionAt(text, text.length)
  return new vscode.Range(0, 0, end.line, end.character)
}

async function formatWxmlTextWithHtmlFormatter(text: string, options: vscode.FormattingOptions) {
  const htmlDocument = await vscode.workspace.openTextDocument({
    language: 'html',
    content: text,
  })
  const edits = await vscode.commands.executeCommand<readonly TextEditLike[]>(
    'vscode.executeFormatDocumentProvider',
    htmlDocument.uri,
    options,
  )

  if (!edits || edits.length === 0) {
    return text
  }

  return applyTextEdits(text, edits)
}

export class WeappWxmlDocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {
  async provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions) {
    if (!isWxmlEnhancementEnabled() || !isStandaloneWxmlEnhancementEnabled()) {
      return []
    }

    const sourceText = document.getText()
    const formattedText = await formatWxmlTextWithHtmlFormatter(sourceText, options)

    if (formattedText === sourceText) {
      return []
    }

    return [{
      range: getFullDocumentRange(sourceText),
      newText: formattedText,
    }]
  }
}
