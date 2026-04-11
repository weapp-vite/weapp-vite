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
    expect(code).toContain('import type { ComponentOptionsMixin, DefineComponent, PublicProps, WeappIntrinsicElementBaseAttributes } from \'wevu\'')
    expect(code).not.toContain('weapp-vite/typed-components')
    expect(code).toContain('readonly size?: string;')
    expect(code).toContain('Props & WeappIntrinsicElementBaseAttributes')
    expect(code).toContain('InstanceType<DefineComponent<{}, {}, {}, {}, {}, ComponentOptionsMixin')
    expect(code).not.toContain('@ts-nocheck')
  })

  it('references weapp-vite/typed-components when enabled', () => {
    const code = createVueComponentsDefinition(
      ['t-avatar', 'van-button'],
      () => ({ types: new Map([['size', 'string']]), docs: new Map() }),
      { useTypedComponents: true },
    )
    expect(code).toContain('declare module \'vue\'')
    expect(code).toContain('import type { ComponentProp } from \'weapp-vite/typed-components\'')
    expect(code).toContain('TAvatar: WeappComponent<ComponentProp<\"t-avatar\">>;')
    expect(code).toContain('\'t-avatar\': WeappComponent<ComponentProp<\"t-avatar\">>;')
    expect(code).toContain('VanButton: WeappComponent<ComponentProp<\"van-button\">>;')
    expect(code).toContain('\'van-button\': WeappComponent<ComponentProp<\"van-button\">>;')
    expect(code).not.toContain('readonly size?: string;')
    expect(code).not.toContain('[component: string]: WeappComponent;')
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
    expect(code).toContain('VanInfo: __WeappComponentImport<typeof import(\"@vant/weapp/lib/info/index.js\"), WeappComponent<ComponentProp<\"van-info\">>>;')
    expect(code).toContain('type __WeappComponentProps<TComponent> = TComponent extends new (...args: any[]) => { $props: infer Props } ? Props : Record<string, any>')
    expect(code).toContain('type __WeappComponentImport<TModule, Fallback = {}> = 0 extends 1 & TModule ? Fallback : TModule extends { default: infer Component } ? Component extends new (...args: infer Args) => infer Instance ? new (...args: Args) => Omit<Instance, \'$props\'> & { $props: __WeappComponentProps<Component> & __WeappComponentProps<Fallback> } : Fallback : Fallback')
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
          '',
          'void ok',
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
          '  export type ComponentProp<Name extends string> = Name extends ComponentPropName ? ComponentProps[Name] : Record<string, any>',
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
      jsxImportSource: 'wevu',
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      baseUrl: projectRoot,
    })

    const diagnostics = languageService.getSemanticDiagnostics(entryFile)
    expect(diagnostics).toEqual([])
  })

  it('adds index signature when component list is empty', () => {
    const code = createVueComponentsDefinition(
      [],
      () => ({ types: new Map(), docs: new Map() }),
      { useTypedComponents: true },
    )
    expect(code).toContain('[component: string]: WeappComponent;')
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
