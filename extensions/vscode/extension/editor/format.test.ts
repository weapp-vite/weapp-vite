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

it('formats wxml in-process without opening an html formatter document', async () => {
  const openTextDocument = vi.fn()
  const executeCommand = vi.fn()

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
  const sourceText = '<view> <text>{{ msg }}</text> </view>\n'
  const edits = await provider.provideDocumentFormattingEdits(createDocument(sourceText) as never, {
    insertSpaces: true,
    tabSize: 2,
  })

  assert.equal(openTextDocument.mock.calls.length, 0)
  assert.equal(executeCommand.mock.calls.length, 0)
  assert.equal(edits.length, 1)
  assert.deepEqual(edits[0]?.range.start, { line: 0, character: 0 })
  assert.deepEqual(edits[0]?.range.end, { line: 1, character: 0 })
  assert.equal(edits[0]?.newText.includes('undefined'), false)
  assert.equal(edits[0]?.newText, '<view>\n  <text>{{ msg }}</text>\n</view>\n')

  vi.doUnmock('vscode')
  vi.resetModules()
})

it('returns no edits when the in-process formatter does not change the wxml content', async () => {
  const openTextDocument = vi.fn()
  const executeCommand = vi.fn()

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
  const edits = await provider.provideDocumentFormattingEdits(createDocument('<view />\n') as never, {
    insertSpaces: true,
    tabSize: 2,
  })

  assert.deepEqual(edits, [])
  assert.equal(openTextDocument.mock.calls.length, 0)
  assert.equal(executeCommand.mock.calls.length, 0)

  vi.doUnmock('vscode')
  vi.resetModules()
})
