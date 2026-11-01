import type * as vscode from 'vscode'
import path from 'node:path'
import { analyzeDocument, analyzeScript } from '@weapp-vite/language-service'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ documents: new Map<string, vscode.TextDocument>() }))

vi.mock('vscode', () => {
  class Position {
    constructor(public line: number, public character: number) {}
  }
  class Range {
    constructor(public start: Position, public end: Position) {}
  }
  class Location {
    constructor(public uri: vscode.Uri, public range: Range) {}
  }
  class WorkspaceEdit {
    edits: { uri: vscode.Uri, range: Range, newText: string }[] = []
    replace(uri: vscode.Uri, range: Range, newText: string) {
      this.edits.push({ uri, range, newText })
    }
  }
  return {
    Position,
    Range,
    Location,
    WorkspaceEdit,
    CompletionItem: class {
      constructor(public label: string, public kind: number) {}
    },
    CompletionItemKind: { Function: 1, Module: 2, Variable: 3 },
    MarkdownString: class {
      constructor(public value: string) {}
    },
    Hover: class {
      constructor(public contents: unknown, public range: Range) {}
    },
    DocumentLink: class {
      constructor(public range: Range, public target: vscode.Uri) {}
    },
    Diagnostic: class {
      constructor(public range: Range, public message: string, public severity: number) {}
    },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2 },
    RelativePattern: class {
      constructor(public base: unknown, public pattern: string) {}
    },
    Uri: { file: (fsPath: string) => ({ fsPath, path: fsPath, toString: () => fsPath }) },
    workspace: {
      isTrusted: false,
      getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
      getWorkspaceFolder: () => ({ uri: { fsPath: path.resolve('/workspace') } }),
      findFiles: async ({ pattern }: { pattern: string }) => {
        const extensions = /\{([^}]+)\}/u.exec(pattern)?.[1].split(',') ?? []
        return [...state.documents.values()].filter(document => extensions.some(extension => document.uri.fsPath.endsWith(`.${extension}`))).map(document => document.uri)
      },
      openTextDocument: async (uri: vscode.Uri) => {
        const document = state.documents.get(uri.fsPath)
        if (!document) {
          throw new Error('missing fixture')
        }
        return document
      },
    },
  }
})

vi.mock('../project/workspace', () => ({ findNearestWeappViteProjectWorkspaceFolder: async () => undefined }))
vi.mock('../template/templateProjectIndex', () => ({
  resolveTemplateLinkTarget: async (document: vscode.TextDocument, _attribute: string, source: string) => path.resolve(path.dirname(document.uri.fsPath), source),
}))

const { TemplateModuleProviders } = await import('./modules/providers')
const { NamedTemplateProviders } = await import('./namedTemplates')
const { MiniProgramScriptProviders } = await import('./scriptProviders')
const { getTemplateModules, getModuleUses } = await import('./modules/model')
const { toEditorDiagnostic } = await import('./diagnostics')
const { invalidateLanguageProjectConfiguration, getLanguageDocumentState } = await import('./project')

function document(fileName: string, source: string) {
  const fsPath = path.resolve('/workspace', fileName)
  const result = {
    uri: { fsPath, path: fsPath, toString: () => fsPath },
    languageId: /\.(?:wxs|sjs|ks)$/u.test(fsPath) ? 'miniprogram-script' : fsPath.endsWith('.wxml') ? 'wxml' : 'miniprogram-template',
    version: 1,
    getText: () => source,
    positionAt: (offset: number) => {
      const lines = source.slice(0, offset).split('\n')
      return { line: lines.length - 1, character: lines.at(-1)!.length }
    },
    offsetAt: (position: vscode.Position) => source.split('\n').slice(0, position.line).reduce((offset, line) => offset + line.length + 1, position.character),
  } as vscode.TextDocument
  state.documents.set(fsPath, result)
  return result
}

function position(document: vscode.TextDocument, text: string, offset = 1) {
  return document.positionAt(document.getText().indexOf(text) + offset)
}

function changes(edit: vscode.WorkspaceEdit | null) {
  return (edit as unknown as { edits: { uri: vscode.Uri, range: vscode.Range, newText: string }[] } | null)?.edits ?? []
}

function apply(document: vscode.TextDocument, edit: vscode.WorkspaceEdit | null) {
  let source = document.getText()
  for (const change of changes(edit).filter(change => change.uri.fsPath === document.uri.fsPath).sort((left, right) => document.offsetAt(right.range.start) - document.offsetAt(left.range.start))) {
    source = source.slice(0, document.offsetAt(change.range.start)) + change.newText + source.slice(document.offsetAt(change.range.end))
  }
  return source
}

beforeEach(() => {
  state.documents.clear()
  invalidateLanguageProjectConfiguration()
})

describe('shared native module providers', () => {
  it('navigates and renames external exports across templates while preserving literals and shadowing', async () => {
    const script = document('tools.wxs', 'var value = 1; module.exports = { value };')
    const template = document('page.wxml', '<wxs module="tools" src="./tools.wxs"/><view>{{ tools.value }} {{ "tools.value" }}</view><view wx:for="{{rows}}" wx:for-item="tools">{{tools.value}}</view>')
    const second = document('second.wxml', '<wxs module="alias" src="./tools.wxs"/><text>{{ alias[\'value\'] }}</text>')
    const provider = new TemplateModuleProviders()
    const memberPosition = position(template, 'tools.value', 7)
    const definition = await provider.provideDefinition(template, memberPosition)
    expect(definition?.uri.fsPath).toBe(script.uri.fsPath)
    expect(script.offsetAt(definition!.range.start)).toBe(script.getText().indexOf('value'))
    const references = await provider.provideReferences(template, memberPosition, { includeDeclaration: false })
    expect(references.map(reference => reference.uri.fsPath).sort()).toEqual([template.uri.fsPath, second.uri.fsPath].sort())
    const rename = await provider.provideRenameEdits(template, memberPosition, 'amount')
    expect(apply(script, rename)).toBe('var value = 1; module.exports = { amount: value };')
    expect(apply(template, rename)).toContain('{{ tools.amount }} {{ "tools.value" }}')
    expect(apply(template, rename)).toContain('{{tools.value}}</view>')
    expect(apply(second, rename)).toContain('alias[\'amount\']')
  })

  it('keeps module alias rename local and refuses captures and reserved words', async () => {
    document('tools.wxs', 'module.exports.value = 1;')
    const template = document('page.wxml', '<wxs module="tools" src="./tools.wxs"/><view wx:for="{{rows}}" wx:for-item="row">{{tools.value}}</view>')
    const provider = new TemplateModuleProviders()
    expect(await provider.provideRenameEdits(template, position(template, 'tools.value'), 'row')).toBeNull()
    expect(await provider.provideRenameEdits(template, position(template, 'tools.value'), 'class')).toBeNull()
    const rename = await provider.provideRenameEdits(template, position(template, 'tools.value'), 'helpers')
    expect(changes(rename)).toHaveLength(2)
    expect(changes(rename).every(change => change.uri.fsPath === template.uri.fsPath)).toBe(true)
  })

  it.each([
    ['page.wxml', '<wxs module="tools">var n=1; module.exports={value:n};</wxs>'],
    ['page.axml', '<sjs module="tools">var n=1; export default {value:n};</sjs>'],
    ['page.ttml', '<sjs module="tools">var n=1; module.exports={value:n};</sjs>'],
    ['page.ksml', '<ks module="tools">var n=1; module.exports={value:n};</ks>'],
  ])('maps inline script and member offsets in %s', async (fileName, module) => {
    const template = document(fileName, `${module}<text>{{ tools.value }}</text>`)
    const provider = new TemplateModuleProviders()
    const definition = await provider.provideDefinition(template, position(template, 'tools.value', 7))
    expect(definition?.uri.fsPath).toBe(template.uri.fsPath)
    expect(template.offsetAt(definition!.range.start)).toBe(template.getText().indexOf('n=1'))
    const local = await provider.provideRenameEdits(template, position(template, 'n=1'), 'count')
    expect(apply(template, local)).toContain('value:count')
    expect(apply(template, local)).toContain('var count=1')
  })

  it('uses alipay import-sjs name/from and ignores locally bound expression variables', async () => {
    document('tools.sjs', 'var value=1; export { value };')
    const template = document('page.axml', '<import-sjs name="tools" from="./tools.sjs"/><view>{{ tools.value }} {{ (function(tools){ return tools.value })(row) }}</view>')
    const modules = await getTemplateModules(template)
    expect(modules).toHaveLength(1)
    expect(getModuleUses(template, modules)).toHaveLength(1)
    expect(modules[0].analysis.dialect).toBe('sjs')
  })

  it('exposes native local references and rejects collisions without touching property shorthand', async () => {
    const script = document('tools.wxs', 'var value=1; function f(value){return value;} module.exports={value};')
    const provider = new MiniProgramScriptProviders()
    const rename = await provider.provideRenameEdits(script, position(script, 'value=1'), 'amount')
    expect(apply(script, rename)).toBe('var amount=1; function f(value){return value;} module.exports={value: amount};')
    expect(await provider.provideRenameEdits(script, position(script, 'value=1'), 'f')).toBeNull()
    expect(await provider.provideRenameEdits(script, position(script, 'value=1'), 'return')).toBeNull()
    expect(analyzeScript({ source: apply(script, rename), fileName: 'tools.wxs' }).valid).toBe(true)
  })

  it('renames a public export initiated from a standalone script into importing templates', async () => {
    const script = document('tools.wxs', 'var value=1; module.exports={value};')
    const template = document('page.wxml', '<wxs module="tools" src="./tools.wxs"/><text>{{tools.value}}</text>')
    const provider = new MiniProgramScriptProviders()
    const exportPosition = script.positionAt(script.getText().lastIndexOf('value') + 1)
    const rename = await provider.provideRenameEdits(script, exportPosition, 'amount')
    expect(apply(script, rename)).toContain('module.exports={amount: value}')
    expect(apply(template, rename)).toContain('tools.amount')
  })

  it('maps UTF-16 diagnostics exactly and analyzes untrusted buffers without importing project code', async () => {
    const template = document('invalid.wxml', '😀<view wx:else="x"/>')
    const result = analyzeDocument({ source: template.getText(), fileName: template.uri.fsPath })
    expect(result.diagnostics.length).toBeGreaterThan(0)
    for (const diagnostic of result.diagnostics) {
      const editor = toEditorDiagnostic(template, diagnostic)
      expect(template.offsetAt(editor.range.start)).toBe(diagnostic.start)
      expect(editor.code).toBe(diagnostic.code)
    }
    expect((await getLanguageDocumentState(template)).configuration).toBeUndefined()
  })

  it('navigates and renames named templates through direct imports without editing dynamic names', async () => {
    const library = document('library.wxml', '<template name="row"><view/></template>')
    const template = document('page.wxml', '<import src="./library.wxml"/><template is="row"/><template is="{{name}}"/>')
    const provider = new NamedTemplateProviders()
    const cursor = position(template, 'is="row"', 5)
    expect((await provider.provideDefinition(template, cursor))?.uri.fsPath).toBe(library.uri.fsPath)
    const references = await provider.provideReferences(library, position(library, 'row'), { includeDeclaration: true })
    expect(references).toHaveLength(2)
    const rename = await provider.provideRenameEdits(template, cursor, 'record')
    expect(apply(template, rename)).toContain('is="record"/><template is="{{name}}"')
    expect(apply(library, rename)).toContain('name="record"')
  })

  it('refuses ambiguous or colliding named template rename', async () => {
    document('library.wxml', '<template name="row"/>')
    const ambiguous = document('page.wxml', '<import src="./library.wxml"/><template name="row"/><template is="row"/>')
    const provider = new NamedTemplateProviders()
    expect(await provider.provideDefinition(ambiguous, ambiguous.positionAt(ambiguous.getText().lastIndexOf('row') + 1))).toBeNull()
    const local = document('local.wxml', '<template name="row"/><template name="record"/><template is="row"/>')
    expect(await provider.provideRenameEdits(local, position(local, 'row'), 'record')).toBeNull()
  })

  it('scans named template references alongside plaintext Vue sources without template blocks', async () => {
    const library = document('library.wxml', '<template name="row"><view/></template>')
    const template = document('page.wxml', '<import src="./library.wxml"/><template is="row"/>')
    const sourceOnly = document('sourceOnly.vue', '<script setup>const value=1</script>')
    Object.assign(sourceOnly, { languageId: 'plaintext' })
    const provider = new NamedTemplateProviders()
    const rename = await provider.provideRenameEdits(template, position(template, 'is="row"', 5), 'record')
    expect(apply(library, rename)).toContain('name="record"')
    expect(apply(template, rename)).toContain('is="record"')
    expect(apply(sourceOnly, rename)).toBe(sourceOnly.getText())
  })
})
