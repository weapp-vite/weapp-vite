import path from 'node:path'
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
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  }

  return ts.createLanguageService(host)
}

describe('createVueComponentsDefinition', () => {
  it('inlines props when typed-components reuse is disabled', () => {
    const code = createVueComponentsDefinition(
      ['t-avatar'],
      () => ({ types: new Map([['size', 'string']]), docs: new Map() }),
      { useTypedComponents: false },
    )
    expect(code).toContain('import type { ComponentOptionsMixin, DefineComponent, PublicProps } from \'wevu\'')
    expect(code).toContain('import type { WevuJsxHostAttributes } from \'wevu/jsx-runtime\'')
    expect(code).not.toContain('weapp-vite/typed-components')
    expect(code).toContain('readonly size?: string;')
    expect(code).toContain('Props & WevuJsxHostAttributes')
    expect(code).toContain('InstanceType<DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin')
    expect(code).not.toContain('@ts-nocheck')
    expect(code).toContain('declare module \'wevu/jsx-runtime\'')
    expect(code.match(/^ {4}TAvatar: WevuComponent</gm)).toHaveLength(1)
    expect(code.match(/^ {4}TAvatar: __WevuComponentProps<WevuComponent</gm)).toHaveLength(1)
    expect(code.match(/^ {4}'t-avatar': WevuComponent</gm)).toHaveLength(1)
    expect(code.match(/^ {4}'t-avatar': __WevuComponentProps<WevuComponent</gm)).toHaveLength(1)
  })

  it('references weapp-vite/typed-components when enabled', () => {
    const code = createVueComponentsDefinition(
      ['t-avatar', 'van-button'],
      () => ({ types: new Map([['size', 'string']]), docs: new Map() }),
      { useTypedComponents: true },
    )
    expect(code).toContain('declare module \'vue\'')
    expect(code).toContain('import type { ComponentProp } from \'weapp-vite/typed-components\'')
    expect(code).toContain('TAvatar: WevuComponent<ComponentProp<\"t-avatar\">>;')
    expect(code).toContain('\'t-avatar\': WevuComponent<ComponentProp<\"t-avatar\">>;')
    expect(code).toContain('VanButton: WevuComponent<ComponentProp<\"van-button\">>;')
    expect(code).toContain('\'van-button\': WevuComponent<ComponentProp<\"van-button\">>;')
    expect(code).not.toContain('readonly size?: string;')
    expect(code).not.toContain('[component: string]')
  })

  it('uses custom module name when provided', () => {
    const code = createVueComponentsDefinition(
      ['t-empty'],
      () => ({ types: new Map(), docs: new Map() }),
      { useTypedComponents: true, moduleName: 'wevu' },
    )
    expect(code).toContain('declare module \'wevu\'')
  })

  it('adds source import types for navigation when provided', () => {
    const code = createVueComponentsDefinition(
      ['van-info'],
      () => ({ types: new Map(), docs: new Map() }),
      {
        useTypedComponents: true,
        resolveComponentImport: () => '@vant/weapp/lib/info/index.js',
      },
    )
    expect(code).toContain('VanInfo: __WevuComponentImport<typeof import(\"@vant/weapp/lib/info/index.js\"), WevuComponent<ComponentProp<\"van-info\">>>;')
    expect(code.match(/typeof import\("@vant\/weapp\/lib\/info\/index\.js"\)/g)).toHaveLength(2)
    expect(code).toContain('VanInfo: __WevuComponentProps<WevuComponent<ComponentProp<\"van-info\">>>;')
    expect(code.slice(code.indexOf('declare module \'wevu/jsx-runtime\''))).not.toContain('@vant/weapp/lib/info/index.js')
  })

  it('sanitizes raw metadata identifiers before emitting inline props', () => {
    const code = createVueComponentsDefinition(
      ['filter-bar'],
      () => ({
        types: new Map([
          ['filters', 'FilterItem[]'],
          ['remote', 'ImportedFilter'],
        ]),
        docs: new Map(),
      }),
      { useTypedComponents: false },
    )

    expect(code).not.toContain('FilterItem')
    expect(code).not.toContain('ImportedFilter')
    expect(code).toContain('readonly filters?: unknown[];')
    expect(code).toContain('readonly remote?: unknown;')
  })

  it('keeps base attrs like class for source-imported native components', () => {
    const projectRoot = path.resolve(__dirname, '../../..')
    const entryFile = path.join(projectRoot, 'test/__virtual__/components-class-props.tsx')
    const typedComponentsFile = path.join(projectRoot, 'test/__virtual__/typed-components.d.ts')
    const vueComponentsFile = path.join(projectRoot, 'test/__virtual__/components.d.ts')
    const resolverComponentFile = path.join(projectRoot, 'test/__virtual__/vant-tabbar.d.ts')
    const vueComponentsCode = createVueComponentsDefinition(
      ['Tabbar'],
      () => ({ types: new Map([['active', 'boolean']]), docs: new Map() }),
      {
        useTypedComponents: true,
        resolveComponentImport: () => resolverComponentFile,
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

  it('emits strict empty component maps without an index signature', () => {
    const code = createVueComponentsDefinition(
      [],
      () => ({ types: new Map(), docs: new Map() }),
      { useTypedComponents: true },
    )
    expect(code).toContain('interface GlobalComponents {')
    expect(code).toContain('interface WevuJsxGlobalComponents {')
    expect(code).not.toContain('[component: string]')
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
