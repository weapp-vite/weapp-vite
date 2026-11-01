import type * as vscode from 'vscode'
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ format: vi.fn(), input: vi.fn() }))

vi.mock('../languages/project', () => ({
  formatProjectDocument: state.format,
  getLanguageDocumentState: state.input,
}))
vi.mock('../shared/config', () => ({ isWxmlEnhancementEnabled: () => true, isStandaloneWxmlEnhancementEnabled: () => true }))
vi.mock('vscode', () => ({ Range: class {} }))

const { WeappWxmlDocumentFormattingProvider, WeappNativeDocumentFormattingProvider } = await import('./format')

function document(source: string) {
  return { version: 1, getText: () => source } as vscode.TextDocument
}

beforeEach(() => {
  state.format.mockReset()
  state.input.mockReset().mockResolvedValue({ input: { fileName: 'page.wxml' } })
})

it('uses the same project format result and refuses a stale edit', async () => {
  const source = '<view   class="a"><text>  A  B  </text></view>'
  const buffer = document(source)
  const formatted = '<view class="a"><text>  A  B  </text></view>'
  state.format.mockResolvedValueOnce(formatted)
  const provider = new WeappWxmlDocumentFormattingProvider()
  expect((await provider.provideDocumentFormattingEdits(buffer, { tabSize: 2, insertSpaces: true }))[0].newText).toBe(formatted)
  state.format.mockImplementationOnce(async () => {
    Object.assign(buffer, { version: 2 })
    return formatted
  })
  expect(await provider.provideDocumentFormattingEdits(buffer, { tabSize: 2, insertSpaces: true })).toEqual([])
})

it('reports configuration or native semantic failures and returns no edits', async () => {
  const buffer = document('invalid')
  const error = new Error('module semantics changed')
  const report = vi.fn()
  state.format.mockRejectedValue(error)
  expect(await new WeappNativeDocumentFormattingProvider(report).provideDocumentFormattingEdits(buffer)).toEqual([])
  expect(report).toHaveBeenCalledWith(buffer, error)
  state.input.mockRejectedValueOnce(error)
  expect(await new WeappWxmlDocumentFormattingProvider(report).provideDocumentFormattingEdits(buffer, { tabSize: 2, insertSpaces: true })).toEqual([])
})

it('falls back to the lossless TS formatter only for a template without project tools', async () => {
  const source = '<view   class="a"><text>  A  B  </text></view>'
  state.format.mockResolvedValue(undefined)
  const edits = await new WeappWxmlDocumentFormattingProvider().provideDocumentFormattingEdits(document(source), { tabSize: 2, insertSpaces: true })
  expect(edits[0].newText).toBe('<view class="a"><text>  A  B  </text></view>')
})

it.each(['<view><text>invalid</view>\n', '<view class="unfinished>'])('returns an empty edit array for malformed template %s', async (source) => {
  state.format.mockResolvedValue(undefined)
  const buffer = document(source)
  const report = vi.fn()
  const provider = new WeappWxmlDocumentFormattingProvider(report)

  expect(await provider.provideDocumentFormattingEdits(buffer, { tabSize: 2, insertSpaces: true })).toEqual([])
  expect(report).toHaveBeenCalledWith(buffer, expect.any(Error))
  expect(buffer.getText()).toBe(source)
})
