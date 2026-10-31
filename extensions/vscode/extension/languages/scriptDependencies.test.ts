import type * as vscode from 'vscode'
import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ documents: new Map<string, vscode.TextDocument>() }))

vi.mock('vscode', () => ({
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Range: class {
    constructor(public start: vscode.Position, public end: vscode.Position) {}
  },
  Location: class {
    constructor(public uri: vscode.Uri, public range: vscode.Range) {}
  },
  WorkspaceEdit: class {
    edits: { uri: vscode.Uri, range: vscode.Range, newText: string }[] = []
    replace(uri: vscode.Uri, range: vscode.Range, newText: string) {
      this.edits.push({ uri, range, newText })
    }
  },
  Hover: class {
    constructor(public contents: unknown, public range: vscode.Range) {}
  },
  MarkdownString: class {
    constructor(public value: string) {}
  },
  CompletionItem: class {
    constructor(public label: string, public kind: number) {}
  },
  CompletionItemKind: { Variable: 1, Function: 2 },
  RelativePattern: class {
    constructor(public base: unknown, public pattern: string) {}
  },
  Uri: { file: (fsPath: string) => ({ fsPath, path: fsPath }) },
  workspace: {
    isTrusted: false,
    getWorkspaceFolder: () => ({ uri: { fsPath: path.resolve('/workspace') } }),
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
    findFiles: async ({ pattern }: { pattern: string }) => {
      const extensions = /\{([^}]+)\}/u.exec(pattern)?.[1].split(',') ?? []
      return [...state.documents.values()].filter(document => extensions.some(extension => document.uri.fsPath.endsWith(`.${extension}`))).map(document => document.uri)
    },
    openTextDocument: async (uri: vscode.Uri) => {
      const result = state.documents.get(uri.fsPath)
      if (!result) {
        throw new Error('missing dependency fixture')
      }
      return result
    },
  },
}))
vi.mock('../project/workspace', () => ({ findNearestWeappViteProjectWorkspaceFolder: async () => undefined }))
vi.mock('../template/templateProjectIndex', () => ({ resolveTemplateLinkTarget: async (document: vscode.TextDocument, _attribute: string, source: string) => path.resolve(path.dirname(document.uri.fsPath), source) }))

const { MiniProgramScriptProviders } = await import('./scriptProviders')
const { TemplateModuleProviders } = await import('./modules/providers')
const { invalidateLanguageProjectConfiguration } = await import('./project')

function document(name: string, source: string) {
  const fsPath = path.resolve('/workspace', name)
  const result = {
    uri: { fsPath, path: fsPath },
    version: 1,
    languageId: name.endsWith('.wxml') ? 'wxml' : name.endsWith('.vue') ? 'vue' : 'miniprogram-script',
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

function position(document: vscode.TextDocument, source: string, offset = 1) {
  return document.positionAt(document.getText().indexOf(source) + offset)
}

function apply(document: vscode.TextDocument, edit: vscode.WorkspaceEdit | null) {
  const changes = (edit as unknown as { edits: { uri: vscode.Uri, range: vscode.Range, newText: string }[] } | null)?.edits ?? []
  let source = document.getText()
  for (const change of changes.filter(change => change.uri.fsPath === document.uri.fsPath).sort((left, right) => document.offsetAt(right.range.start) - document.offsetAt(left.range.start))) {
    source = source.slice(0, document.offsetAt(change.range.start)) + change.newText + source.slice(document.offsetAt(change.range.end))
  }
  return source
}

beforeEach(() => {
  state.documents.clear()
  invalidateLanguageProjectConfiguration()
})

it('follows require aliases, destructuring, computed members and source shadowing', async () => {
  const library = document('library.wxs', 'var value=1; module.exports={value};')
  const consumer = document('consumer.wxs.ts', 'const tools=require("./library.wxs"); const alias=tools; const {value:local}=tools; const result=alias["value"]; function hidden(tools){return tools.value;} const text="tools.value";')
  const shorthand = document('shorthand.wxs.ts', 'const {value}=require("./library.wxs"); value;')
  const provider = new MiniProgramScriptProviders()
  const cursor = position(consumer, 'alias["value"]', 8)
  expect((await provider.provideDefinition(consumer, cursor))?.uri.fsPath).toBe(library.uri.fsPath)
  const rename = await provider.provideRenameEdits(consumer, cursor, 'amount')
  expect(apply(library, rename)).toBe('var value=1; module.exports={amount: value};')
  expect(apply(consumer, rename)).toContain('{amount:local}=tools')
  expect(apply(consumer, rename)).toContain('alias["amount"]')
  expect(apply(consumer, rename)).toContain('return tools.value;')
  expect(apply(consumer, rename)).toContain('text="tools.value"')
  expect(apply(shorthand, rename)).toContain('{amount: value}=require')
  expect(apply(shorthand, rename)).toContain('; value;')
  const references = await provider.provideReferences(consumer, cursor, { includeDeclaration: true })
  expect(references.some(location => location.uri.fsPath === shorthand.uri.fsPath)).toBe(true)
})

it('preserves local named import aliases during public rename and public names during local rename', async () => {
  const library = document('library.sjs.ts', 'const value=1; export {value};')
  const consumer = document('consumer.sjs.ts', 'import {value} from "./library.sjs.ts"; value;')
  const alias = document('alias.sjs.ts', 'import {value as local} from "./library.sjs.ts"; local;')
  const provider = new MiniProgramScriptProviders()
  expect((await provider.provideDefinition(alias, position(alias, 'local;', 2)))?.uri.fsPath).toBe(library.uri.fsPath)
  const publicRename = await provider.provideRenameEdits(library, library.positionAt(library.getText().lastIndexOf('value') + 1), 'amount')
  expect(apply(consumer, publicRename)).toBe('import {amount as value} from "./library.sjs.ts"; value;')
  expect(apply(alias, publicRename)).toBe('import {amount as local} from "./library.sjs.ts"; local;')
  const localRename = await provider.provideRenameEdits(consumer, consumer.positionAt(consumer.getText().lastIndexOf('value') + 1), 'local')
  expect(apply(consumer, localRename)).toBe('import {value as local} from "./library.sjs.ts"; local;')
  expect(apply(library, localRename)).toBe(library.getText())
})

it.each(['import tools from', 'import * as tools from'])('resolves %s and offers namespace member completion', async (statement) => {
  const isDefault = statement === 'import tools from'
  const library = document('library.sjs.ts', isDefault ? 'const value=1; export default {value};' : 'export const value=1;')
  const consumer = document('consumer.sjs.ts', `${statement} "./library.sjs.ts"; tools.value;`)
  const provider = new MiniProgramScriptProviders()
  const cursor = position(consumer, 'tools.value', 8)
  expect((await provider.provideDefinition(consumer, cursor))?.uri.fsPath).toBe(library.uri.fsPath)
  const items = await provider.provideCompletionItems(consumer, position(consumer, 'tools.value', 6))
  expect(items.some(item => item.label === 'value')).toBe(true)
  const rename = await provider.provideRenameEdits(consumer, cursor, 'amount')
  expect(apply(consumer, rename)).toContain('tools.amount')
})

it('separates same-named named and default-object exports for definition, references and rename', async () => {
  const library = document('library.sjs.ts', 'const value=1; export {value}; export default {value};')
  const consumer = document('consumer.sjs.ts', 'import defaults, {value as local} from "./library.sjs.ts"; import * as namespace from "./library.sjs.ts"; defaults.value; namespace.value; local;')
  const provider = new MiniProgramScriptProviders()
  const defaultCursor = position(consumer, 'defaults.value', 11)
  const defaultRename = await provider.provideRenameEdits(consumer, defaultCursor, 'amount')
  expect(apply(library, defaultRename)).toBe('const value=1; export {value}; export default {amount: value};')
  expect(apply(consumer, defaultRename)).toContain('defaults.amount; namespace.value; local;')
  expect(apply(consumer, defaultRename)).toContain('{value as local}')
  const namedCursor = position(consumer, 'namespace.value', 12)
  const namedRename = await provider.provideRenameEdits(consumer, namedCursor, 'amount')
  expect(apply(library, namedRename)).toBe('const value=1; export {value as amount}; export default {value};')
  expect(apply(consumer, namedRename)).toContain('{amount as local}')
  expect(apply(consumer, namedRename)).toContain('defaults.value; namespace.amount; local;')
  const defaultReferences = await provider.provideReferences(consumer, defaultCursor, { includeDeclaration: true })
  expect(defaultReferences.filter(reference => reference.uri.fsPath === consumer.uri.fsPath).map(reference => consumer.getText().slice(consumer.offsetAt(reference.range.start), consumer.offsetAt(reference.range.end)))).toEqual(['value'])
})

it('maps compiled CommonJS API paths to source export scopes and leaves nested value properties alone', async () => {
  const library = document('library.wxs.ts', 'const value=1; export {value}; export default {value};')
  const consumer = document('consumer.wxs.ts', 'const tools=require("./library.wxs.ts"); tools.value; tools.default.value; tools.value.nested; const {default:defaults}=tools; defaults.value;')
  const template = document('page.wxml', '<wxs module="tools" src="./library.wxs.ts"/><text>{{tools.value}} {{tools.default.value}} {{tools.default["value"].nested}}</text>')
  const provider = new MiniProgramScriptProviders()
  const cursor = position(consumer, 'tools.default.value', 16)
  expect((await provider.provideDefinition(consumer, cursor))?.uri.fsPath).toBe(library.uri.fsPath)
  const rename = await provider.provideRenameEdits(consumer, cursor, 'amount')
  expect(apply(library, rename)).toContain('export default {amount: value}')
  expect(apply(consumer, rename)).toContain('tools.value; tools.default.amount; tools.value.nested;')
  expect(apply(consumer, rename)).toContain('defaults.amount;')
  expect(apply(template, rename)).toContain('{{tools.value}} {{tools.default.amount}} {{tools.default["amount"].nested}}')
  expect(await provider.provideRenameEdits(consumer, position(consumer, 'tools.value.nested', 15), 'amount')).toBeNull()
  const completions = await provider.provideCompletionItems(consumer, position(consumer, 'tools.default.value', 14))
  expect(completions.map(item => item.label)).toContain('value')
  const templateProvider = new TemplateModuleProviders()
  const templateRename = await templateProvider.provideRenameEdits(template, position(template, 'tools.default.value', 16), 'amount')
  expect(apply(library, templateRename)).toContain('export default {amount: value}')
  expect(apply(consumer, templateRename)).toContain('tools.default.amount')
  const templateCompletions = await templateProvider.provideCompletionItems(template, position(template, 'tools.default.value', 14))
  expect(templateCompletions.map(item => item.label)).toContain('value')
})

it('flattens default-only compiled modules and refuses a shared source key with multiple public scopes', async () => {
  const library = document('library.wxs.ts', 'const value=1; export default {value};')
  const consumer = document('consumer.wxs.ts', 'const tools=require("./library.wxs.ts"); tools.value;')
  const provider = new MiniProgramScriptProviders()
  const rename = await provider.provideRenameEdits(consumer, position(consumer, 'tools.value', 8), 'amount')
  expect(apply(library, rename)).toContain('export default {amount: value}')
  expect(apply(consumer, rename)).toContain('tools.amount')
  const mixed = document('mixed.sjs.ts', 'const value=1; const api={value}; export default api; module.exports=api;')
  const mixedConsumer = document('mixedConsumer.sjs.ts', 'import tools from "./mixed.sjs.ts"; tools.value;')
  expect(await provider.provideRenameEdits(mixedConsumer, position(mixedConsumer, 'tools.value', 8), 'amount')).toBeNull()
  expect(mixed.getText()).toContain('api={value}')
})

it('allows a real CommonJS property named default while preserving synthetic ESM default identity', async () => {
  const library = document('library.wxs', 'module.exports.default=1;')
  const consumer = document('consumer.wxs', 'var tools=require("./library.wxs"); tools.default;')
  const provider = new MiniProgramScriptProviders()
  const cursor = position(consumer, 'tools.default', 8)
  expect(await provider.prepareRename(consumer, cursor)).not.toBeNull()
  const rename = await provider.provideRenameEdits(consumer, cursor, 'value')
  expect(apply(library, rename)).toBe('module.exports.value=1;')
  expect(apply(consumer, rename)).toContain('tools.value')
})

it('indexes Vue project sources without a Vue extension and ignores missing template blocks during rename', async () => {
  const library = document('library.wxs', 'var value=1;module.exports={value:value};')
  const template = document('page.wxml', '<wxs module="tools" src="./library.wxs"/><text>{{tools.value}}</text>')
  const vue = document('page.vue', '<wxs module="helpers" src="./library.wxs"/><template><text>{{helpers.value}}</text></template>')
  const scriptOnly = document('scriptOnly.vue', '<script setup>const value=1</script>')
  Object.assign(vue, { languageId: 'plaintext' })
  Object.assign(scriptOnly, { languageId: 'plaintext' })
  const provider = new TemplateModuleProviders()
  const rename = await provider.provideRenameEdits(template, position(template, 'tools.value', 8), 'amount')
  expect(apply(library, rename)).toContain('module.exports={amount:value}')
  expect(apply(template, rename)).toContain('{{tools.amount}}')
  expect(apply(vue, rename)).toContain('{{helpers.amount}}')
  expect(apply(scriptOnly, rename)).toBe(scriptOnly.getText())
})

it('includes inline native dependency uses and preserves local import shorthand in a Vue custom module block', async () => {
  const library = document('library.wxs', 'var value=1;module.exports={value};')
  const template = document('page.wxml', '<wxs module="inline">var tools=require("./library.wxs");module.exports={value:tools.value};</wxs><text>{{inline.value}}</text>')
  const provider = new TemplateModuleProviders()
  const cursor = position(template, 'tools.value', 8)
  expect((await provider.provideDefinition(template, cursor))?.uri.fsPath).toBe(library.uri.fsPath)
  const rename = await provider.provideRenameEdits(template, cursor, 'amount')
  expect(apply(template, rename)).toContain('{value:tools.amount}')
  expect(apply(template, rename)).toContain('{{inline.value}}')
  const vue = document('page.vue', '<wxs module="tools" lang="ts">import {value} from "./library.wxs"; export {value};</wxs><template><text>{{tools.value}}</text></template>')
  const local = await provider.provideRenameEdits(vue, position(vue, 'import {value}', 10), 'local')
  expect(apply(vue, local)).toContain('import {value as local}')
  expect(apply(vue, local)).toContain('export {local as value}')
})
