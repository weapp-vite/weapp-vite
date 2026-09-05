import path from 'node:path'
import { proxyCreateProgram } from '@volar/typescript'
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createVueComponentsDefinition } from './vueDefinition'

function normalizeFileKey(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/')
  return ts.sys.useCaseSensitiveFileNames ? normalized : normalized.toLowerCase()
}

function createLanguageService(files: Map<string, string>, options: ts.CompilerOptions) {
  const fileNames = [...files.keys()]
  const snapshots = new Map(
    fileNames.map(fileName => [normalizeFileKey(fileName), files.get(fileName)!]),
  )

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => fileNames,
    getScriptVersion: () => '1',
    getScriptSnapshot: (targetFileName) => {
      const text = snapshots.get(normalizeFileKey(targetFileName)) ?? ts.sys.readFile(targetFileName)
      if (text == null) {
        return undefined
      }
      return ts.ScriptSnapshot.fromString(text)
    },
    getCurrentDirectory: () => process.cwd(),
    getCompilationSettings: () => options,
    getDefaultLibFileName: targetOptions => ts.getDefaultLibFilePath(targetOptions),
    fileExists: targetFileName => snapshots.has(normalizeFileKey(targetFileName)) || ts.sys.fileExists(targetFileName),
    readFile: targetFileName => snapshots.get(normalizeFileKey(targetFileName)) ?? ts.sys.readFile(targetFileName),
    readDirectory: ts.sys.readDirectory,
    directoryExists: directory => fileNames.some(fileName => normalizeFileKey(fileName).startsWith(`${normalizeFileKey(directory)}/`)) || ts.sys.directoryExists(directory),
    getDirectories: ts.sys.getDirectories,
  }

  return ts.createLanguageService(host)
}

describe('createVueComponentsDefinition', () => {
  it.each([false, true])('keeps native source attributes and metadata fallback (typed=%s)', (useTypedComponents) => {
    const projectRoot = path.resolve(__dirname, '../../..')
    const entryFile = path.join(projectRoot, 'test/__virtual__/components-class-props.tsx')
    const typedComponentsFile = path.join(projectRoot, 'test/__virtual__/typed-components.d.ts')
    const vueComponentsFile = path.join(projectRoot, 'test/__virtual__/components.d.ts')
    const resolverComponentFile = path.join(projectRoot, 'test/__virtual__/vant-tabbar.d.ts')
    const metadataComponentFile = path.join(projectRoot, 'test/__virtual__/metadata-card.d.ts')
    const vueComponentsCode = createVueComponentsDefinition(
      ['Tabbar', 'MetadataCard'],
      () => ({ types: new Map([['active', 'boolean']]), docs: new Map() }),
      {
        useTypedComponents,
        resolveComponentImport: name => name === 'Tabbar' ? resolverComponentFile : metadataComponentFile,
      },
    )
    const files = new Map<string, string>([
      [
        entryFile,
        [
          '/// <reference path="./components.d.ts" />',
          'import type {} from \'vue\'',
          '',
          'const ok = <Tabbar class="text-red" active />',
          'const metadata = <MetadataCard class="text-red" active />',
          '// @ts-expect-error 元数据组件不允许未知属性。',
          'const badMetadata = <MetadataCard typo />',
          'const bad = <Tabbar typo />',
          '',
          'void ok',
          'void bad',
        ].join('\n'),
      ],
      [
        typedComponentsFile,
        [
          'declare module \'weapp-vite/typed-components\' {',
          '  export interface ComponentProps {',
          '    Tabbar: {',
          '      readonly active?: boolean;',
          '    }',
          '    MetadataCard: { readonly active?: boolean }',
          '  }',
          '  export type ComponentPropName = keyof ComponentProps',
          '  export type ComponentProp<Name extends string> = Name extends ComponentPropName ? ComponentProps[Name] : object',
          '}',
        ].join('\n'),
      ],
      [
        resolverComponentFile,
        [
          'declare const _default: new (...args: any[]) => {',
          '  $props: {',
          '    active?: boolean',
          '  }',
          '}',
          'export default _default',
        ].join('\n'),
      ],
      [metadataComponentFile, 'export {}'],
      [vueComponentsFile, vueComponentsCode],
    ])
    const languageService = createLanguageService(files, {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: 'wevu/weapp',
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      baseUrl: projectRoot,
    })

    const diagnostics = languageService.getSemanticDiagnostics(entryFile)
    expect(diagnostics).toHaveLength(1)
    expect(ts.flattenDiagnosticMessageText(diagnostics[0]!.messageText, '\n')).toContain('typo')
  })

  it.each([false, true])('preserves source SFC contracts in TSX and templates (typed=%s)', (useTypedComponents) => {
    const projectRoot = path.resolve(__dirname, '../../..')
    const entryFile = path.join(projectRoot, 'test/source-contract.tsx')
    const sourceFile = path.join(projectRoot, 'test/SourceCard.vue')
    const genericSourceFile = path.join(projectRoot, 'test/GenericCard.vue')
    const templateFile = path.join(projectRoot, 'test/Consumer.vue')
    const definitionFile = path.join(projectRoot, 'test/components.d.ts')
    const typedFile = path.join(projectRoot, 'test/typed-components.d.ts')
    const files = new Map([
      [sourceFile, [
        '<script setup lang="ts">',
        'defineProps<{ title: string }>()',
        'defineEmits<{ change: [value: string] }>()',
        '</script>',
        '<template><slot /></template>',
      ].join('\n')],
      [genericSourceFile, [
        '<script setup lang="ts" generic="T extends string">',
        'defineProps<{ title: string; value?: T }>()',
        'defineEmits<{ change: [value: T] }>()',
        '</script>',
        '<template><slot /></template>',
      ].join('\n')],
      [templateFile, '<template><SourceCard title="ok" /><source-card title="ok" /></template>'],
      [entryFile, [
        'const pascal = <SourceCard title="ok" hidden onTap={() => {}} onChange={value => value.toUpperCase()} />',
        'const kebab = <source-card title="ok" hidden onTap={() => {}} onChange={value => value.toUpperCase()} />',
        '// @ts-expect-error 必填 prop 不能被 metadata 可选化。',
        'const missingPascal = <SourceCard />',
        '// @ts-expect-error kebab 标签使用同一个源组件契约。',
        'const missingKebab = <source-card />',
        '// @ts-expect-error 事件参数必须保持源组件的 string 类型。',
        'const wrongPascal = <SourceCard title="ok" onChange={(value: number) => {}} />',
        '// @ts-expect-error kebab 标签同样校验事件参数。',
        'const wrongKebab = <source-card title="ok" onChange={(value: number) => {}} />',
        'const genericPascal = <GenericCard title="ok" value="hello" onChange={value => value.toUpperCase()} />',
        'const genericKebab = <generic-card title="ok" value="hello" hidden onTap={() => {}} onChange={value => value.toUpperCase()} />',
        '// @ts-expect-error 可调用的泛型组件仍然需要必填 prop。',
        'const missingGeneric = <generic-card />',
        '// @ts-expect-error 泛型组件的非泛型 prop 不能丢失。',
        'const wrongGenericTitle = <generic-card title={123} />',
        '// @ts-expect-error 泛型约束仍然限制组件值。',
        'const wrongGenericValue = <generic-card title="ok" value={123} />',
        '// @ts-expect-error 泛型事件参数必须保留约束。',
        'const wrongGenericEvent = <generic-card title="ok" onChange={(value: number) => {}} />',
        'export {}',
      ].join('\n')],
      [definitionFile, createVueComponentsDefinition(
        ['source-card', 'generic-card'],
        () => ({ types: new Map([['title', 'string']]), docs: new Map() }),
        {
          useTypedComponents,
          resolveComponentImport: name => name === 'generic-card' ? './GenericCard.vue' : './SourceCard.vue',
        },
      )],
      [typedFile, [
        'declare module \'weapp-vite/typed-components\' {',
        '  export type ComponentProp<Name extends string> = { readonly title?: string }',
        '}',
      ].join('\n')],
    ])
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: 'wevu/weapp',
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      allowNonTsExtensions: true,
      types: [],
    }
    const host = ts.createCompilerHost(options)
    const readFile = host.readFile.bind(host)
    const fileExists = host.fileExists.bind(host)
    const snapshots = new Map([...files].map(([name, content]) => [normalizeFileKey(name), content]))
    host.readFile = fileName => snapshots.get(normalizeFileKey(fileName)) ?? readFile(fileName)
    host.fileExists = fileName => snapshots.has(normalizeFileKey(fileName)) || fileExists(fileName)
    host.getSourceFile = (fileName, languageVersion) => {
      const source = host.readFile(fileName)
      return source === undefined ? undefined : ts.createSourceFile(fileName, source, languageVersion)
    }
    const createProgram = proxyCreateProgram(ts, ts.createProgram, (tsInstance, programOptions) => ({
      languagePlugins: [createVueLanguagePlugin<string>(
        tsInstance,
        programOptions.options,
        { ...getDefaultCompilerOptions(), lib: 'vue', checkUnknownComponents: true },
        id => id,
      )],
    }))
    const program = createProgram({ host, rootNames: [...files.keys()], options })
    const diagnostics = [...files.keys()].flatMap(fileName => ts.getPreEmitDiagnostics(
      program,
      program.getSourceFile(fileName),
    ))
    expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
  })

  it('emits WevuPageLayoutMap augmentation when layout names are provided', () => {
    const code = createVueComponentsDefinition(
      ['t-empty'],
      () => ({ types: new Map(), docs: new Map() }),
      {
        useTypedComponents: true,
        layoutNames: ['admin', 'native-shell'],
        layoutPropsMap: new Map([
          ['admin', new Map([
            ['sidebar', 'boolean'],
            ['title', 'string'],
          ])],
          ['native-shell', new Map([
            ['title', 'string'],
          ])],
        ]),
      },
    )

    expect(code).toContain('declare module \'wevu\'')
    expect(code).toContain('interface WevuPageLayoutMap')
    expect(code).toContain('admin: {')
    expect(code).toContain('readonly sidebar?: boolean;')
    expect(code).toContain('readonly title?: string;')
    expect(code).toContain('\'native-shell\': {')
  })
})
