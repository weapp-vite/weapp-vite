/// <reference types="node" />

import assert from 'node:assert/strict'
import { it, vi } from 'vitest'

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

function createDocument(text: string) {
  return {
    getText() {
      return text
    },
  }
}

it('delegates wxml formatting to the html formatter and returns a full-document replacement edit', async () => {
  const openTextDocument = vi.fn(async (options: { language: string, content: string }) => ({
    uri: { scheme: 'untitled', path: '/virtual/demo.html' },
    getText() {
      return options.content
    },
  }))
  const executeCommand = vi.fn(async (_command: string, _uri: unknown, _options: unknown) => [
    {
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 0 },
      },
      newText: '  ',
    },
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        openTextDocument,
        getConfiguration: () => ({
          get(_key: string, defaultValue: unknown) {
            return defaultValue
          },
        }),
      },
      commands: {
        executeCommand,
      },
      Range: class {
        start: { line: number, character: number }
        end: { line: number, character: number }

        constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
          this.start = { line: startLine, character: startCharacter }
          this.end = { line: endLine, character: endCharacter }
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappWxmlDocumentFormattingProvider,
  } = await import('./format')
  const provider = new WeappWxmlDocumentFormattingProvider()
  const sourceText = '<view>\n<text>{{ msg }}</text>\n</view>\n'
  const edits = await provider.provideDocumentFormattingEdits(createDocument(sourceText) as never, {
    insertSpaces: true,
    tabSize: 2,
  })

  assert.equal(openTextDocument.mock.calls[0]?.[0]?.language, 'html')
  assert.equal(openTextDocument.mock.calls[0]?.[0]?.content, sourceText)
  assert.equal(executeCommand.mock.calls[0]?.[0], 'vscode.executeFormatDocumentProvider')
  assert.equal(edits.length, 1)
  assert.deepEqual(edits[0]?.range.start, { line: 0, character: 0 })
  assert.deepEqual(edits[0]?.range.end, { line: 3, character: 0 })
  assert.equal(edits[0]?.newText, '<view>\n  <text>{{ msg }}</text>\n</view>\n')

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('returns no edits when the delegated html formatter does not change the wxml content', async () => {
  vi.doMock('vscode', () => {
    const mockVscode = {
      workspace: {
        openTextDocument: async (options: { content: string }) => ({
          uri: { scheme: 'untitled', path: '/virtual/demo.html' },
          getText() {
            return options.content
          },
        }),
        getConfiguration: () => ({
          get(_key: string, defaultValue: unknown) {
            return defaultValue
          },
        }),
      },
      commands: {
        executeCommand: async () => [],
      },
      Range: class {
        start: { line: number, character: number }
        end: { line: number, character: number }

        constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
          this.start = { line: startLine, character: startCharacter }
          this.end = { line: endLine, character: endCharacter }
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappWxmlDocumentFormattingProvider,
  } = await import('./format')
  const provider = new WeappWxmlDocumentFormattingProvider()
  const edits = await provider.provideDocumentFormattingEdits(createDocument('<view />') as never, {
    insertSpaces: true,
    tabSize: 2,
  })

  assert.deepEqual(edits, [])

  vi.doUnmock('vscode')
  vi.resetModules()
})
