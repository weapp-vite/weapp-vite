import assert from 'node:assert/strict'
import { afterEach, it, vi } from 'vitest'

afterEach(() => {
  vi.clearAllMocks()
  vi.doUnmock('vscode')
  vi.doUnmock('./templateDecorations')
  vi.resetModules()
})

it('emits class semantic tokens only for resolved template class ranges', async () => {
  const pushedRanges: unknown[] = []
  const resolvedRange = { start: { line: 0, character: 13 }, end: { line: 0, character: 23 } }

  vi.doMock('vscode', () => {
    const mockVscode = {
      SemanticTokensLegend: class {
        constructor(public tokenTypes: string[]) {}
      },
      SemanticTokensBuilder: class {
        push(range: unknown, tokenType: string) {
          pushedRanges.push({ range, tokenType })
        }

        build() {
          return { data: pushedRanges }
        }
      },
    }

    return {
      ...mockVscode,
      default: mockVscode,
    }
  })
  vi.doMock('./templateDecorations', () => ({
    collectDefinedTemplateClassDecorationRanges: async () => [resolvedRange],
    isDecorationEnabledForDocument: async () => true,
  }))
  vi.resetModules()

  const {
    WeappTemplateSemanticTokensProvider,
  } = await import('./templateSemanticTokens')
  const result = await new WeappTemplateSemanticTokensProvider().provideDocumentSemanticTokens({} as any)

  assert.deepEqual(result.data, [{ range: resolvedRange, tokenType: 'class' }])
})
